/**
 * Consolidated social API. All operations are routed via the `?action=` query
 * param so the whole social surface lives in a single Serverless Function
 * (Vercel Hobby plan caps the project at 12 functions). Action names are
 * matched case-insensitively.
 *
 * Firestore data model (STANDARD for the whole app — top-level collections):
 *   following/{username}/user_following/{targetUsername} -> { timestamp }
 *   followers/{username}/user_followers/{followerUsername} -> { timestamp }
 * (The now-deleted standalone followUser/unfollowUser/getFollowing endpoints
 *  used users/{u}/following + users/{u}/followers subcollections; we
 *  standardized on this top-level model because `feed` also depends on it.)
 *
 * Actions:
 *   - follow        POST  ?action=follow
 *                   body  { username, targetUsername }  (target_username also accepted)
 *                   resp  { message }
 *   - unfollow      POST  ?action=unfollow
 *                   body  { username, targetUsername }
 *                   resp  { message }
 *   - following     GET   ?action=following&username=<u>
 *                   resp  { following: [{ username, name, timestamp }] }
 *   - followers     GET   ?action=followers&username=<u>
 *                   resp  { followers: [{ username, name, timestamp }] }
 *   - feed          GET   ?action=feed&username=<u>
 *                   resp  { recipe_posts: [<normalized post>...] }
 *                   Aggregates posts authored by the people <u> follows from BOTH
 *                   the `logs` collection (real meals logged via createRecipeLog)
 *                   and the legacy/demo `recipe_posts` collection, normalized to a
 *                   common shape and sorted newest-first.
 *   - login         POST  ?action=login
 *                   body  { username } | { email }
 *                   resp  { ...userData, username }
 *   - searchUsers   GET   ?action=searchUsers&q=<prefix>
 *                   resp  { users: [{ username, name, profilePhotoUrl }] }  (<=20)
 *   - recommendedFollows  GET  ?action=recommendedFollows&username=<u>
 *                   resp  { hasProfile: bool, recommendations: [{ username, name,
 *                   profilePhotoUrl, matchReason, matchScore }] }  (<=6)
 *                   Scores other users by overlapping kitchen personality traits,
 *                   cuisines, and favorite ingredients. Excludes self + already-followed.
 *   - checkEmail    GET   ?action=checkEmail&email=<e>
 *                   resp  { exists: bool, username? }
 *                   Checks the `users` collection by email (sign-up persists it).
 *                   Used by Forgot Password to decide reset-vs-signup. We do NOT
 *                   use Firebase fetchSignInMethodsForEmail because email
 *                   enumeration protection makes it return an empty list.
 *   - postDetail    GET   ?action=postDetail&postId=<id>&collection=<c>&username=<u>
 *                   collection is 'logs' (default) or 'recipe_posts'.
 *                   resp  { post: <normalized>, comments: [...], likes: [{username,name}], likedByMe }
 *   - comments      GET   ?action=comments&postId=<id>
 *                   resp  { comments: [{ id, username, name, text, timestamp }] }
 *   - addComment    POST  ?action=addComment
 *                   body  { username, postId, collection, text }
 *                   resp  { message, comment, comments_count }
 *   - deleteComment POST  ?action=deleteComment
 *                   body  { username, postId, commentId, collection }
 *                   resp  { message, comments_count }
 *                   Only the comment author may delete (username must match).
 *   - likes         GET   ?action=likes&postId=<id>
 *                   resp  { likes: [{ username, name }], likes_count }
 *   - like          POST  ?action=like
 *                   body  { username, postId, collection }
 *                   resp  { message, likes_count }
 *   - unlike        POST  ?action=unlike
 *                   body  { username, postId, collection }
 *                   resp  { message, likes_count }
 *   - userLogs      GET   ?action=userLogs&username=<u>
 *                   resp  { logs: [<normalized post from `logs` collection>...] }
 *                   Returns a user's own logged meals, newest-first.
 *   - portfolioFavorites  POST  ?action=portfolioFavorites
 *                   body  { username, dishId }
 *                   Toggles a logged dish in the user's public portfolio showcase
 *                   (max 2). Stored on users/{username}.portfolio_favorites.
 *                   resp  { portfolio_favorites: [dishId...] }
 *
 * Likes / comments data model (top-level collections keyed by post document id,
 * which is a globally-unique Firestore auto-id so logs and recipe_posts never
 * collide):
 *   post_likes/{postId}/users/{username}      -> { timestamp }
 *   post_comments/{postId}/items/{autoId}     -> { username, name, text, timestamp }
 * A denormalized `likes_count` / `comments_count` is also maintained on the post
 * document itself (in `logs` or `recipe_posts`) so the feed can show counts
 * without extra per-post reads.
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { hasProfileData, rankRecommendations } = require('../utils/recommendFollows');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const {
  POST_COLLECTIONS,
  normalizeUsername,
  validatePostId,
  sanitizeCommentText,
  validateEmail,
  validateSearchQuery,
  resolveCollection,
} = require('./_helpers/validateInput');

const SEARCH_RESULT_LIMIT = 20;
const RECOMMENDED_CANDIDATE_LIMIT = 50;
const RECOMMENDED_RESULT_LIMIT = 6;
const FEED_LIMIT = 50;

let db;
try {
  if (!getApps().length) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set');
    }
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  db = getFirestore();
} catch (error) {
  console.error('Firebase initialization error:', error);
  // db will be undefined, which will cause errors in the handler
}

function methodNotAllowed(res) {
  res.status(405).send('Method Not Allowed');
}

async function handleFollow(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, targetUsername, target_username } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const targetUser = normalizeUsername(targetUsername || target_username);
  if (!targetUser) {
    return res.status(400).json({ error: 'Valid targetUsername is required' });
  }
  if (auth.username === targetUser) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  const userRef = db.collection('users').doc(auth.username);
  const targetRef = db.collection('users').doc(targetUser);
  const [userDoc, targetDoc] = await Promise.all([userRef.get(), targetRef.get()]);
  if (!userDoc.exists || !targetDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const followingRef = db
    .collection('following')
    .doc(auth.username)
    .collection('user_following')
    .doc(targetUser);
  const followersRef = db
    .collection('followers')
    .doc(targetUser)
    .collection('user_followers')
    .doc(auth.username);

  const existing = await followingRef.get();
  if (existing.exists) {
    return res.status(400).json({ error: 'Already following this user' });
  }

  const timestamp = FieldValue.serverTimestamp();
  await Promise.all([
    followingRef.set({ timestamp }),
    followersRef.set({ timestamp })
  ]);

  res.status(200).json({ message: `Now following ${targetUser}` });
}

async function handleUnfollow(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, targetUsername, target_username } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const targetUser = normalizeUsername(targetUsername || target_username);
  if (!targetUser) {
    return res.status(400).json({ error: 'Valid targetUsername is required' });
  }

  const userRef = db.collection('users').doc(auth.username);
  const targetRef = db.collection('users').doc(targetUser);
  const [userDoc, targetDoc] = await Promise.all([userRef.get(), targetRef.get()]);
  if (!userDoc.exists || !targetDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const followingRef = db
    .collection('following')
    .doc(auth.username)
    .collection('user_following')
    .doc(targetUser);
  const followersRef = db
    .collection('followers')
    .doc(targetUser)
    .collection('user_followers')
    .doc(auth.username);

  const existing = await followingRef.get();
  if (!existing.exists) {
    return res.status(400).json({ error: 'Not following this user' });
  }

  await Promise.all([followingRef.delete(), followersRef.delete()]);
  res.status(200).json({ message: `Unfollowed ${targetUser}` });
}

async function handleFollowers(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const userDoc = await db.collection('users').doc(username).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const snapshot = await db
    .collection('followers')
    .doc(username)
    .collection('user_followers')
    .orderBy('timestamp', 'desc')
    .get();

  const followers = [];
  for (const followerDoc of snapshot.docs) {
    const followerId = followerDoc.id;
    const followerData = await db.collection('users').doc(followerId).get();
    followers.push({
      username: followerId,
      name: followerData.exists ? followerData.data().name : undefined,
      timestamp: followerDoc.data().timestamp || null
    });
  }

  res.status(200).json({ followers });
}

async function handleFollowing(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const userDoc = await db.collection('users').doc(username).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const snapshot = await db
    .collection('following')
    .doc(username)
    .collection('user_following')
    .orderBy('timestamp', 'desc')
    .get();

  const following = [];
  for (const followedDoc of snapshot.docs) {
    const followedId = followedDoc.id;
    const followedData = await db.collection('users').doc(followedId).get();
    following.push({
      username: followedId,
      name: followedData.exists ? followedData.data().name : undefined,
      timestamp: followedDoc.data().timestamp || null
    });
  }

  res.status(200).json({ following });
}

// Convert a Firestore timestamp (Admin Timestamp, {seconds}, ISO string, or
// epoch millis) into epoch milliseconds. Returns 0 when unknown so undated
// posts sort to the bottom.
function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Normalize a post document from either `logs` (createRecipeLog shape) or
// `recipe_posts` (legacy/demo shape) into one shape the app consumes. `logs`
// use camelCase (title/photoUrl/createdAt); `recipe_posts` use snake_case
// (recipe_name/created_at). We accept both for every field.
function normalizePost(doc, collectionName) {
  const data = doc.data() || {};
  const createdMs = toMillis(data.createdAt || data.created_at);
  return {
    id: doc.id,
    postSource: collectionName,
    username: data.username,
    title: data.title || data.recipe_name || 'Untitled dish',
    description: data.notes || data.cooking_notes || '',
    photoUrl: data.photoUrl || data.photo_url || data.image || null,
    rating: data.rating != null ? data.rating : null,
    difficulty: data.difficulty || data.difficulty_level || null,
    time: data.time || data.cooking_time || null,
    ingredients: data.ingredients || null,
    recipeLink: data.recipeLink || data.recipe_link || null,
    recipeInstructions: data.recipeInstructions || data.recipe_instructions || null,
    // Original recipe "source" (e.g. a website/cookbook), distinct from
    // postSource which is the Firestore collection.
    source: data.source || null,
    cookedWith: Array.isArray(data.cookedWith) ? data.cookedWith.filter(Boolean) : [],
    created_at_ms: createdMs,
    likes_count: data.likes_count || 0,
    comments_count: data.comments_count || 0,
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function handleFeed(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const userDoc = await db.collection('users').doc(username).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const followingSnapshot = await db
    .collection('following')
    .doc(username)
    .collection('user_following')
    .get();

  const followedUsers = followingSnapshot.docs.map(doc => doc.id);
  if (followedUsers.length === 0) {
    return res.status(200).json({ recipe_posts: [] });
  }

  // Firestore `in` queries allow at most 10 values, so batch the followed set.
  // We sort in memory (rather than orderBy) so neither collection needs a
  // composite index, and so logs (createdAt) and recipe_posts (created_at) can
  // be merged on a single normalized timestamp.
  const chunks = chunk(followedUsers, 10);
  const posts = [];
  for (const collectionName of POST_COLLECTIONS) {
    for (const batch of chunks) {
      const snapshot = await db
        .collection(collectionName)
        .where('username', 'in', batch)
        .get();
      snapshot.forEach(doc => posts.push(normalizePost(doc, collectionName)));
    }
  }

  posts.sort((a, b) => b.created_at_ms - a.created_at_ms);
  const trimmedPosts = posts.slice(0, FEED_LIMIT);

  const uniqueUsernames = [...new Set(trimmedPosts.map(post => post.username).filter(Boolean))];
  const userDocs = await Promise.all(
    uniqueUsernames.map(user => db.collection('users').doc(user).get())
  );

  const userMap = {};
  userDocs.forEach(doc => {
    if (doc.exists) {
      userMap[doc.id] = { username: doc.id, name: doc.data().name };
    }
  });

  const recipePosts = trimmedPosts.map(post => ({
    ...post,
    user: userMap[post.username] || { username: post.username }
  }));

  res.status(200).json({ recipe_posts: recipePosts });
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, email } = req.body;
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = validateEmail(email);

  if (!normalizedUsername && !normalizedEmail) {
    return res.status(400).json({ error: 'Valid username or email is required' });
  }

  let userDoc;
  if (normalizedUsername) {
    userDoc = await db.collection('users').doc(normalizedUsername).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
  } else {
    const snapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    userDoc = snapshot.docs[0];
  }

  const userData = userDoc.data();
  res.status(200).json({ ...userData, username: userData.username || userDoc.id });
}

function toPublicUser(doc) {
  const data = doc.data() || {};
  return {
    username: data.username || doc.id,
    name: data.name || null,
    profilePhotoUrl: data.profilePhotoUrl || null
  };
}

async function handleSearchUsers(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const prefix = validateSearchQuery(req.query.q);
  if (!prefix) {
    return res.status(200).json({ users: [] });
  }

  const usersRef = db.collection('users');
  const end = prefix + '\uf8ff';
  const byUsername = new Map();

  // Prefix match on the `username` field (document id == username, but we
  // match the field so this also works if ids ever diverge from usernames).
  try {
    const usernameSnap = await usersRef
      .orderBy('username')
      .startAt(prefix)
      .endAt(end)
      .limit(SEARCH_RESULT_LIMIT)
      .get();
    usernameSnap.forEach((doc) => byUsername.set(doc.id, toPublicUser(doc)));
  } catch (fieldErr) {
    // Some legacy docs may lack a `username` field; fall back to a scan and
    // filter by document id prefix so search still returns results.
    console.log('username field query failed, falling back to scan:', fieldErr.message);
    const scanSnap = await usersRef.limit(200).get();
    const lowerPrefix = prefix.toLowerCase();
    scanSnap.forEach((doc) => {
      if (doc.id.toLowerCase().startsWith(lowerPrefix)) {
        byUsername.set(doc.id, toPublicUser(doc));
      }
    });
  }

  // Also try to match on the `name` field prefix (best-effort).
  if (byUsername.size < SEARCH_RESULT_LIMIT) {
    try {
      const nameSnap = await usersRef
        .orderBy('name')
        .startAt(prefix)
        .endAt(end)
        .limit(SEARCH_RESULT_LIMIT)
        .get();
      nameSnap.forEach((doc) => {
        if (!byUsername.has(doc.id)) byUsername.set(doc.id, toPublicUser(doc));
      });
    } catch (nameErr) {
      console.log('name field query unavailable:', nameErr.message);
    }
  }

  const users = Array.from(byUsername.values()).slice(0, SEARCH_RESULT_LIMIT);
  res.status(200).json({ users });
}

async function handleRecommendedFollows(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const userDoc = await db.collection('users').doc(username).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userProfile = { ...userDoc.data(), username: userDoc.id };
  if (!hasProfileData(userProfile)) {
    return res.status(200).json({ hasProfile: false, recommendations: [] });
  }

  const [followingSnap, usersSnap] = await Promise.all([
    db.collection('following').doc(username).collection('user_following').get(),
    db.collection('users').limit(RECOMMENDED_CANDIDATE_LIMIT).get(),
  ]);

  const exclude = [username, ...followingSnap.docs.map((doc) => doc.id)];
  const candidates = [];
  usersSnap.forEach((doc) => {
    candidates.push({ ...doc.data(), username: doc.id });
  });

  const recommendations = rankRecommendations(userProfile, candidates, {
    exclude,
    limit: RECOMMENDED_RESULT_LIMIT,
  });

  res.status(200).json({ hasProfile: true, recommendations });
}

// Forgot Password support. Determines whether an email is registered by looking
// it up in the `users` collection (sign-up persists `email` there). We do NOT
// rely on Firebase's fetchSignInMethodsForEmail: with email-enumeration
// protection enabled it returns an empty array even for real accounts.
async function handleCheckEmail(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const email = validateEmail(req.query.email);
  if (!email) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const snapshot = await db
    .collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return res.status(200).json({ exists: false });
  }

  const doc = snapshot.docs[0];
  const data = doc.data() || {};
  res.status(200).json({ exists: true, username: data.username || doc.id });
}

// Validate + resolve the post's collection. Returns the collection name or
// null (caller should 400). Defaults to 'logs' (where createRecipeLog writes).

async function loadComments(postId) {
  const snapshot = await db
    .collection('post_comments')
    .doc(postId)
    .collection('items')
    .orderBy('timestamp', 'asc')
    .get();

  // Resolve author display names in one pass.
  const usernames = [...new Set(snapshot.docs.map(d => d.data().username).filter(Boolean))];
  const userDocs = await Promise.all(
    usernames.map(u => db.collection('users').doc(u).get())
  );
  const nameMap = {};
  userDocs.forEach(d => {
    if (d.exists) nameMap[d.id] = d.data().name || null;
  });

  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      username: data.username,
      name: data.name || nameMap[data.username] || null,
      text: data.text,
      timestamp: toMillis(data.timestamp) || null,
    };
  });
}

async function loadLikes(postId) {
  const snapshot = await db
    .collection('post_likes')
    .doc(postId)
    .collection('users')
    .get();

  const usernames = snapshot.docs.map(d => d.id);
  const userDocs = await Promise.all(
    usernames.map(u => db.collection('users').doc(u).get())
  );
  return userDocs.map((d, i) => ({
    username: usernames[i],
    name: d.exists ? d.data().name || null : null,
  }));
}

async function handlePostDetail(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const postId = validatePostId(req.query.postId);
  if (!postId) {
    return res.status(400).json({ error: 'Valid postId is required' });
  }
  const collectionName = resolveCollection(req.query.collection);
  if (!collectionName) {
    return res.status(400).json({ error: 'Invalid collection' });
  }
  const viewerUsername = req.query.username ? normalizeUsername(req.query.username) : null;

  const postDoc = await db.collection(collectionName).doc(postId).get();
  if (!postDoc.exists) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const post = normalizePost(postDoc, collectionName);
  // Attach author display name for the detail header.
  if (post.username) {
    const authorDoc = await db.collection('users').doc(post.username).get();
    post.user = authorDoc.exists
      ? { username: post.username, name: authorDoc.data().name }
      : { username: post.username };
  }

  const [comments, likes] = await Promise.all([loadComments(postId), loadLikes(postId)]);
  const likedByMe = viewerUsername ? likes.some(l => l.username === viewerUsername) : false;

  res.status(200).json({ post, comments, likes, likedByMe });
}

async function handleComments(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const postId = validatePostId(req.query.postId);
  if (!postId) {
    return res.status(400).json({ error: 'Valid postId is required' });
  }
  const comments = await loadComments(postId);
  res.status(200).json({ comments });
}

async function handleDeleteComment(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, postId, commentId } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validPostId = validatePostId(postId);
  const validCommentId = validatePostId(commentId);
  if (!validPostId || !validCommentId) {
    return res.status(400).json({ error: 'Valid postId and commentId are required' });
  }
  const collectionName = resolveCollection(req.body.collection);
  if (!collectionName) {
    return res.status(400).json({ error: 'Invalid collection' });
  }

  const commentRef = db
    .collection('post_comments')
    .doc(validPostId)
    .collection('items')
    .doc(validCommentId);
  const commentDoc = await commentRef.get();
  if (!commentDoc.exists) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  if (commentDoc.data().username !== auth.username) {
    return res.status(403).json({ error: 'You can only delete your own comments' });
  }

  await commentRef.delete();

  const postRef = db.collection(collectionName).doc(validPostId);
  const postDoc = await postRef.get();
  let newCount = 0;
  if (postDoc.exists) {
    const current = postDoc.data().comments_count || 0;
    if (current > 0) {
      await postRef.set({ comments_count: FieldValue.increment(-1) }, { merge: true });
      newCount = current - 1;
    }
  }

  res.status(200).json({ message: 'Comment deleted', comments_count: newCount });
}

async function handleAddComment(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, postId, text } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validPostId = validatePostId(postId);
  const commentText = sanitizeCommentText(text);
  if (!validPostId || !commentText) {
    return res.status(400).json({ error: 'Valid postId and comment text are required' });
  }
  const collectionName = resolveCollection(req.body.collection);
  if (!collectionName) {
    return res.status(400).json({ error: 'Invalid collection' });
  }

  const postRef = db.collection(collectionName).doc(validPostId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const userDoc = await db.collection('users').doc(auth.username).get();
  const name = userDoc.exists ? userDoc.data().name || null : null;

  const commentRef = db
    .collection('post_comments')
    .doc(validPostId)
    .collection('items')
    .doc();

  await commentRef.set({
    username: auth.username,
    name,
    text: commentText,
    timestamp: FieldValue.serverTimestamp(),
  });
  await postRef.set({ comments_count: FieldValue.increment(1) }, { merge: true });

  const newCount = (postDoc.data().comments_count || 0) + 1;
  res.status(200).json({
    message: 'Comment added',
    comment: { id: commentRef.id, username: auth.username, name, text: commentText, timestamp: Date.now() },
    comments_count: newCount,
  });
}

async function handleLikes(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const postId = validatePostId(req.query.postId);
  if (!postId) {
    return res.status(400).json({ error: 'Valid postId is required' });
  }
  const likes = await loadLikes(postId);
  res.status(200).json({ likes, likes_count: likes.length });
}

async function handleLike(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, postId } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validPostId = validatePostId(postId);
  if (!validPostId) {
    return res.status(400).json({ error: 'Valid postId is required' });
  }
  const collectionName = resolveCollection(req.body.collection);
  if (!collectionName) {
    return res.status(400).json({ error: 'Invalid collection' });
  }

  const postRef = db.collection(collectionName).doc(validPostId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const likeRef = db.collection('post_likes').doc(validPostId).collection('users').doc(auth.username);
  const existing = await likeRef.get();
  let count = postDoc.data().likes_count || 0;
  if (!existing.exists) {
    await likeRef.set({ timestamp: FieldValue.serverTimestamp() });
    await postRef.set({ likes_count: FieldValue.increment(1) }, { merge: true });
    count += 1;
  }
  res.status(200).json({ message: 'Liked', likes_count: count });
}

const USER_LOGS_LIMIT = 50;
const PORTFOLIO_FAVORITES_MAX = 2;

async function handlePortfolioFavorites(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, dishId } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validDishId = validatePostId(dishId);
  if (!validDishId) {
    return res.status(400).json({ error: 'Valid dishId is required' });
  }

  const userRef = db.collection('users').doc(auth.username);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const data = userDoc.data() || {};
  let favorites = Array.isArray(data.portfolio_favorites) ? [...data.portfolio_favorites] : [];
  const existingIndex = favorites.indexOf(validDishId);

  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
  } else {
    const logDoc = await db.collection('logs').doc(validDishId).get();
    if (!logDoc.exists || logDoc.data().username !== auth.username) {
      return res.status(400).json({ error: 'Dish not found for this user' });
    }
    if (favorites.length >= PORTFOLIO_FAVORITES_MAX) {
      return res.status(400).json({
        error: `You can only showcase up to ${PORTFOLIO_FAVORITES_MAX} favorite dishes`,
        portfolio_favorites: favorites,
      });
    }
    favorites.push(validDishId);
  }

  await userRef.set({ portfolio_favorites: favorites }, { merge: true });
  res.status(200).json({ portfolio_favorites: favorites });
}

async function handleUserLogs(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  let snapshot;
  try {
    snapshot = await db
      .collection('logs')
      .where('username', '==', username)
      .orderBy('createdAt', 'desc')
      .limit(USER_LOGS_LIMIT)
      .get();
  } catch (orderErr) {
    // Fall back without orderBy when older docs lack createdAt / index.
    console.log('userLogs orderBy unavailable, falling back:', orderErr.message);
    snapshot = await db.collection('logs').where('username', '==', username).get();
  }

  const logs = snapshot.docs.map((doc) => normalizePost(doc, 'logs'));
  logs.sort((a, b) => b.created_at_ms - a.created_at_ms);

  res.status(200).json({ logs: logs.slice(0, USER_LOGS_LIMIT) });
}

async function handleUnlike(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, postId } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validPostId = validatePostId(postId);
  if (!validPostId) {
    return res.status(400).json({ error: 'Valid postId is required' });
  }
  const collectionName = resolveCollection(req.body.collection);
  if (!collectionName) {
    return res.status(400).json({ error: 'Invalid collection' });
  }

  const postRef = db.collection(collectionName).doc(validPostId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const likeRef = db.collection('post_likes').doc(validPostId).collection('users').doc(auth.username);
  const existing = await likeRef.get();
  let count = postDoc.data().likes_count || 0;
  if (existing.exists) {
    await likeRef.delete();
    // Guard against going negative if counters ever drift.
    if (count > 0) {
      await postRef.set({ likes_count: FieldValue.increment(-1) }, { merge: true });
      count -= 1;
    }
  }
  res.status(200).json({ message: 'Unliked', likes_count: count });
}

const handlers = {
  follow: handleFollow,
  unfollow: handleUnfollow,
  followers: handleFollowers,
  following: handleFollowing,
  feed: handleFeed,
  login: handleLogin,
  searchusers: handleSearchUsers,
  recommendedfollows: handleRecommendedFollows,
  checkemail: handleCheckEmail,
  postdetail: handlePostDetail,
  comments: handleComments,
  addcomment: handleAddComment,
  deletecomment: handleDeleteComment,
  likes: handleLikes,
  like: handleLike,
  unlike: handleUnlike,
  userlogs: handleUserLogs,
  portfoliofavorites: handlePortfolioFavorites,
};

module.exports = async (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const action = (req.query.action || '').toLowerCase();
  const handler = handlers[action];

  if (!handler) {
    res.status(400).json({
      error: 'Invalid or missing action',
      validActions: Object.keys(handlers)
    });
    return;
  }

  try {
    await handler(req, res);
  } catch (error) {
    console.error(`Error handling social action "${action}":`, error);
    res.status(500).json({ error: `Failed to handle action "${action}"`, details: error.message });
  }
};
