/**
 * Consolidated social API. All operations are routed via the `?action=` query
 * param so the whole social surface lives in a single Serverless Function
 * (Vercel Hobby plan caps the project at 12 functions). Action names are
 * matched case-insensitively.
 *
 * Firestore data model (STANDARD for the whole app — top-level collections):
 *   following/{username}/user_following/{targetUsername} -> { timestamp }
 *     (only written after a follow request is accepted)
 *   followers/{username}/user_followers/{followerUsername} -> { timestamp }
 *   follow_requests/{targetUsername}/requests/{fromUsername}
 *     -> { status: pending|accepted|declined, createdAt, acceptedAt? }
 *   follow_requests_outgoing/{fromUsername}/pending/{targetUsername}
 *     -> { createdAt }  (mirror so we can list sent pending requests without a collection-group index)
 *   notifications/{username}/items/{fromUsername}
 *     -> { type: follow_request, fromUsername, fromName, read, createdAt, requestId, status }
 * (The now-deleted standalone followUser/unfollowUser/getFollowing endpoints
 *  used users/{u}/following + users/{u}/followers subcollections; we
 *  standardized on this top-level model because `feed` also depends on it.)
 *
 * Actions:
 *   - follow        POST  ?action=follow
 *                   body  { username, targetUsername }  (target_username also accepted)
 *                   Creates a pending follow request + notification (does NOT follow immediately).
 *                   resp  { message, status: 'pending' }
 *   - acceptFollowRequest  POST  ?action=acceptFollowRequest
 *                   body  { username, fromUsername }  (username = person accepting)
 *                   resp  { message, fromUsername }
 *   - declineFollowRequest POST  ?action=declineFollowRequest
 *                   body  { username, fromUsername }
 *                   resp  { message }
 *   - notifications GET   ?action=notifications&username=<u>
 *                   resp  { notifications: [...], unreadCount }
 *   - sentFollowRequests GET ?action=sentFollowRequests&username=<u>
 *                   resp  { pending: [{ username, createdAt }] }
 *   - unfollow      POST  ?action=unfollow
 *                   body  { username, targetUsername }
 *                   resp  { message }
 *   - following     GET   ?action=following&username=<u>
 *                   resp  { following: [{ username, name, profilePhotoUrl, timestamp }] }
 *   - followers     GET   ?action=followers&username=<u>
 *                   resp  { followers: [{ username, name, profilePhotoUrl, timestamp }] }
 *   - feed          GET   ?action=feed&username=<u>
 *                   resp  { recipe_posts: [<normalized post>...] }
 *                   Aggregates posts authored by the people <u> follows from BOTH
 *                   the `logs` collection (real meals logged via createRecipeLog)
 *                   and the legacy/demo `recipe_posts` collection, normalized to a
 *                   common shape and sorted newest-first.
 *   - login         POST  ?action=login
 *                   body  { username } | { email }
 *                   resp  { ...publicProfile, username }  (email/uid/push tokens stripped)
 *   - signInEmail   GET   ?action=signInEmail&username=<u>
 *                   resp  { email }
 *                   Pre-auth username -> email map for username-based sign-in.
 *                   Returns ONLY the email; generic 404 when the username is unknown.
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
 *   - checkUsername GET   ?action=checkUsername&username=<u>
 *                   resp  { exists: bool }
 *                   Checks whether a username doc already exists in `users`.
 *                   Used by SignUp to block duplicate usernames before account creation.
 *   - postDetail    GET   ?action=postDetail&postId=<id>&collection=<c>&username=<u>
 *                   collection is 'logs' (default) or 'recipe_posts'.
 *                   resp  { post: <normalized>, comments: [...], likes: [{username,name}], likedByMe }
 *   - comments      GET   ?action=comments&postId=<id>&collection=<logs|recipe_posts>
 *                   resp  { comments: [{ id, username, name, text, parentId?, timestamp, likes_count, likedByMe }] }
 *                   Requires auth; likedByMe reflects only the authenticated viewer.
 *   - addComment    POST  ?action=addComment
 *                   body  { username, postId, collection, text, parentId? }
 *                   parentId (optional) threads the comment as a reply; replies
 *                   are kept one level deep (a reply to a reply re-roots to the
 *                   top-level parent).
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
 *   - likeComment   POST  ?action=likeComment
 *                   body  { username, postId, commentId }
 *                   resp  { message, likes_count, likedByMe }
 *   - unlikeComment POST  ?action=unlikeComment
 *                   body  { username, postId, commentId }
 *                   resp  { message, likes_count, likedByMe }
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
 *   post_comments/{postId}/items/{autoId}     -> { username, name, text, timestamp, likes_count, parentId? }
 *     (parentId, when set, points at another item in the same post's thread,
 *      marking this comment as a one-level-deep reply)
 *   comment_likes/{commentId}/users/{username} -> { timestamp }
 *     (commentId is the post_comments item auto-id, globally unique; a
 *      denormalized likes_count is kept on the comment doc itself)
 * A denormalized `likes_count` / `comments_count` is also maintained on the post
 * document itself (in `logs` or `recipe_posts`) so the feed can show counts
 * without extra per-post reads.
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { hasProfileData, rankRecommendations } = require('../utils/recommendFollows');
const { requireAuth, requireAuthForUsername } = require('./_helpers/verifyAuth');
const {
  POST_COLLECTIONS,
  normalizeUsername,
  validatePostId,
  sanitizeCommentText,
  validateEmail,
  validateSearchQuery,
  resolveCollection,
} = require('./_helpers/validateInput');
const {
  storePushToken,
  removePushToken,
  resolveDisplayName,
  sendInteractionNotification,
} = require('./_helpers/notifications');

const SEARCH_RESULT_LIMIT = 20;
const RECOMMENDED_CANDIDATE_LIMIT = 50;
const RECOMMENDED_RESULT_LIMIT = 6;
const FEED_LIMIT = 50;

// Fields that must never be exposed to a non-owner / unauthenticated caller.
// `email`/`uid` enable account enumeration + impersonation; push token fields
// are normally stored outside the user doc but are stripped here defensively in
// case a legacy doc still carries them.
const SENSITIVE_PROFILE_FIELDS = [
  'email',
  'uid',
  'pushTokens',
  'expoPushTokens',
  'pushToken',
  'expoPushToken',
  'fcmToken',
];

// Strip sensitive fields from a raw user document for public consumption.
function toPublicProfile(userData) {
  const out = { ...userData };
  for (const field of SENSITIVE_PROFILE_FIELDS) {
    delete out[field];
  }
  return out;
}

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

async function establishFollowRelationship(followerUsername, targetUsername) {
  const timestamp = FieldValue.serverTimestamp();
  await Promise.all([
    db
      .collection('following')
      .doc(followerUsername)
      .collection('user_following')
      .doc(targetUsername)
      .set({ timestamp }),
    db
      .collection('followers')
      .doc(targetUsername)
      .collection('user_followers')
      .doc(followerUsername)
      .set({ timestamp }),
  ]);
}

function followRequestRefs(fromUsername, targetUsername) {
  return {
    requestRef: db
      .collection('follow_requests')
      .doc(targetUsername)
      .collection('requests')
      .doc(fromUsername),
    outgoingRef: db
      .collection('follow_requests_outgoing')
      .doc(fromUsername)
      .collection('pending')
      .doc(targetUsername),
    notificationRef: db
      .collection('notifications')
      .doc(targetUsername)
      .collection('items')
      .doc(fromUsername),
  };
}

async function removeFollowRequest(fromUsername, targetUsername) {
  const { requestRef, outgoingRef, notificationRef } = followRequestRefs(
    fromUsername,
    targetUsername
  );
  await Promise.all([requestRef.delete(), outgoingRef.delete(), notificationRef.delete()]);
}

// Privacy gate: only the post owner or someone who follows them may view,
// like, or comment on a user's posts. Uses the standard
// following/{viewer}/user_following/{author} relationship.
async function userFollows(viewerUsername, authorUsername) {
  if (!viewerUsername || !authorUsername) return false;
  if (viewerUsername === authorUsername) return true;
  const doc = await db
    .collection('following')
    .doc(viewerUsername)
    .collection('user_following')
    .doc(authorUsername)
    .get();
  return doc.exists;
}

// Resolve a post's author username. When the collection is known we read it
// directly; otherwise we probe both post collections (postId is a globally
// unique Firestore auto-id, so there is no collision risk).
async function resolvePostAuthor(postId, collectionName = null) {
  if (collectionName) {
    const doc = await db.collection(collectionName).doc(postId).get();
    return doc.exists ? doc.data().username || null : null;
  }
  for (const name of POST_COLLECTIONS) {
    const doc = await db.collection(name).doc(postId).get();
    if (doc.exists) return doc.data().username || null;
  }
  return null;
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
  const { requestRef, outgoingRef, notificationRef } = followRequestRefs(
    auth.username,
    targetUser
  );

  const [existingFollow, existingRequest] = await Promise.all([
    followingRef.get(),
    requestRef.get(),
  ]);
  if (existingFollow.exists) {
    return res.status(400).json({ error: 'Already following this user' });
  }
  if (existingRequest.exists && existingRequest.data().status === 'pending') {
    return res.status(400).json({ error: 'Follow request already pending' });
  }

  const timestamp = FieldValue.serverTimestamp();
  const fromName = userDoc.data().name || auth.username;

  await Promise.all([
    requestRef.set({ status: 'pending', createdAt: timestamp }),
    outgoingRef.set({ createdAt: timestamp }),
    notificationRef.set({
      type: 'follow_request',
      fromUsername: auth.username,
      fromName,
      read: false,
      createdAt: timestamp,
      requestId: auth.username,
      status: 'pending',
    }),
  ]);

  await sendInteractionNotification({
    recipientUsername: targetUser,
    actorUsername: auth.username,
    title: 'New follow request',
    body: `${fromName} wants to follow you`,
    data: { type: 'follow_request', fromUsername: auth.username },
  });

  res.status(200).json({
    message: `Follow request sent to ${targetUser}`,
    status: 'pending',
  });
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
  const { requestRef } = followRequestRefs(auth.username, targetUser);

  const [existingFollow, existingRequest] = await Promise.all([
    followingRef.get(),
    requestRef.get(),
  ]);

  if (existingFollow.exists) {
    await Promise.all([followingRef.delete(), followersRef.delete()]);
    return res.status(200).json({ message: `Unfollowed ${targetUser}` });
  }

  if (existingRequest.exists && existingRequest.data().status === 'pending') {
    await removeFollowRequest(auth.username, targetUser);
    return res.status(200).json({ message: 'Follow request cancelled', status: 'cancelled' });
  }

  return res.status(400).json({ error: 'Not following this user' });
}

async function handleFollowers(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  // Social-graph lists are only exposed to authenticated users.
  const auth = await requireAuth(req, res);
  if (!auth) return;

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
      profilePhotoUrl: followerData.exists ? followerData.data().profilePhotoUrl || null : null,
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

  // Social-graph lists are only exposed to authenticated users.
  const auth = await requireAuth(req, res);
  if (!auth) return;

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
      profilePhotoUrl: followedData.exists ? followedData.data().profilePhotoUrl || null : null,
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
    dishType: data.dishType || data.dish_type || null,
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

  // A feed is inherently the caller's own — only the owner may read it.
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

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
      userMap[doc.id] = toPublicProfile(doc.data()); // 🔘 Stable, case-validated reference alignment
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
  // `login` is unauthenticated, so it must only ever return a public projection
  // (no email/uid/push tokens). Sign-in email resolution lives in the dedicated
  // `signInEmail` action below.
  res.status(200).json({
    ...toPublicProfile(userData),
    username: userData.username || userDoc.id,
  });
}

// Pre-auth sign-in helper. Username-based login needs the account's email to
// hand to Firebase, but we must NOT expose the rest of the profile (or confirm
// arbitrary emails). This action maps a username -> email ONLY. A generic 404
// is returned when the username is unknown to limit enumeration.
async function handleSignInEmail(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  let doc = await db.collection('users').doc(username).get();
  if (!doc.exists) {
    // Fall back to a field lookup in case this account's doc id doesn't match
    // its `username` field (older accounts predating the doc-id convention).
    const querySnap = await db
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();
    if (querySnap.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    doc = querySnap.docs[0];
  }

  const email = doc.data().email || null;
  if (!email) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ email });
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

  const lowerPrefix = prefix.toLowerCase();
  const usersRef = db.collection('users');
  const end = lowerPrefix + '\uf8ff';
  const byUsername = new Map();

  // Prefix match on the `username` field (stored lowercase).
  try {
    const usernameSnap = await usersRef
      .orderBy('username')
      .startAt(lowerPrefix)
      .endAt(end)
      .limit(SEARCH_RESULT_LIMIT)
      .get();
    usernameSnap.forEach((doc) => byUsername.set(doc.id, toPublicUser(doc)));
  } catch (fieldErr) {
    console.log('username field query failed, falling back to scan:', fieldErr.message);
  }

  // Case-insensitive name prefix via `nameLower` when indexed.
  if (byUsername.size < SEARCH_RESULT_LIMIT) {
    try {
      const nameSnap = await usersRef
        .orderBy('nameLower')
        .startAt(lowerPrefix)
        .endAt(end)
        .limit(SEARCH_RESULT_LIMIT)
        .get();
      nameSnap.forEach((doc) => {
        if (!byUsername.has(doc.id)) byUsername.set(doc.id, toPublicUser(doc));
      });
    } catch (nameErr) {
      console.log('nameLower field query unavailable:', nameErr.message);
    }
  }

  // Scan fallback for legacy docs missing indexed fields.
  if (byUsername.size < SEARCH_RESULT_LIMIT) {
    const scanSnap = await usersRef.limit(300).get();
    scanSnap.forEach((doc) => {
      if (byUsername.size >= SEARCH_RESULT_LIMIT) return;
      const data = doc.data() || {};
      const idMatch = doc.id.toLowerCase().startsWith(lowerPrefix);
      const nameMatch = String(data.name || '').toLowerCase().startsWith(lowerPrefix);
      if ((idMatch || nameMatch) && !byUsername.has(doc.id)) {
        byUsername.set(doc.id, toPublicUser(doc));
      }
    });
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

async function handleCheckUsername(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const doc = await db.collection('users').doc(username).get();
  res.status(200).json({ exists: doc.exists });
}

// Validate + resolve the post's collection. Returns the collection name or
// null (caller should 400). Defaults to 'logs' (where createRecipeLog writes).

function commentLikeRef(commentId, username) {
  return db.collection('comment_likes').doc(commentId).collection('users').doc(username);
}

async function loadComments(postId, viewerUsername = null) {
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

  // Only the viewer's own like state needs a per-comment read; the displayed
  // count is denormalized on each comment doc.
  const likedByMeMap = {};
  if (viewerUsername) {
    const likeDocs = await Promise.all(
      snapshot.docs.map(d => commentLikeRef(d.id, viewerUsername).get())
    );
    likeDocs.forEach((likeDoc, i) => {
      likedByMeMap[snapshot.docs[i].id] = likeDoc.exists;
    });
  }

  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      username: data.username,
      name: data.name || nameMap[data.username] || null,
      text: data.text,
      parentId: data.parentId || null,
      timestamp: toMillis(data.timestamp) || null,
      likes_count: data.likes_count || 0,
      likedByMe: likedByMeMap[d.id] || false,
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

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const viewerUsername = auth.username;

  const postDoc = await db.collection(collectionName).doc(postId).get();
  if (!postDoc.exists) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const authorUsername = postDoc.data().username || null;
  if (!(await userFollows(viewerUsername, authorUsername))) {
    return res.status(403).json({ error: 'Follow this user to view their posts' });
  }

  const post = normalizePost(postDoc, collectionName);
  // Attach author display name for the detail header.
  if (post.username) {
    const authorDoc = await db.collection('users').doc(post.username).get();
    post.user = authorDoc.exists
      ? { username: post.username, name: authorDoc.data().name }
      : { username: post.username };
  }

  const [comments, likes] = await Promise.all([
    loadComments(postId, viewerUsername),
    loadLikes(postId),
  ]);
  const likedByMe = viewerUsername ? likes.some(l => l.username === viewerUsername) : false;

  res.status(200).json({ post, comments, likes, likedByMe });
}

async function handleComments(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const postId = validatePostId(req.query.postId);
  if (!postId) {
    return res.status(400).json({ error: 'Valid postId is required' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const collectionName = resolveCollection(req.query.collection);
  const authorUsername = await resolvePostAuthor(postId, collectionName);
  if (!authorUsername) {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (!(await userFollows(auth.username, authorUsername))) {
    return res.status(403).json({ error: 'Follow this user to view their posts' });
  }

  const comments = await loadComments(postId, auth.username);
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

  // Best-effort cleanup of this comment's like docs so they don't orphan.
  try {
    const likeSnap = await db
      .collection('comment_likes')
      .doc(validCommentId)
      .collection('users')
      .get();
    await Promise.all(likeSnap.docs.map((d) => d.ref.delete()));
  } catch (cleanupErr) {
    console.log('comment_likes cleanup failed:', cleanupErr.message);
  }

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

  // Optional idempotency key: if the client never saw the response to an
  // earlier attempt (timeout, dropped connection) and retries, this lets us
  // return the comment that was already created instead of posting a duplicate.
  const clientId = validatePostId(req.body.clientId);

  // Optional parent for threaded replies. Threads are kept one level deep: a
  // reply always attaches to a top-level comment, so if the client replies to
  // an existing reply we re-root it to that reply's parent.
  let parentId = null;
  if (req.body.parentId != null && req.body.parentId !== '') {
    parentId = validatePostId(req.body.parentId);
    if (!parentId) {
      return res.status(400).json({ error: 'Invalid parentId' });
    }
  }

  const postRef = db.collection(collectionName).doc(validPostId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (!(await userFollows(auth.username, postDoc.data().username || null))) {
    return res.status(403).json({ error: 'Follow this user to comment on their posts' });
  }

  const itemsRef = db.collection('post_comments').doc(validPostId).collection('items');

  // For a reply we notify the author of the comment that was replied to (the
  // comment the user actually tapped "reply" on), even when the thread is
  // re-rooted to the top-level parent below.
  let replyToUsername = null;
  if (parentId) {
    const parentDoc = await itemsRef.doc(parentId).get();
    if (!parentDoc.exists) {
      return res.status(404).json({ error: 'Parent comment not found' });
    }
    replyToUsername = parentDoc.data().username || null;
    const grandparentId = parentDoc.data().parentId;
    if (grandparentId) parentId = grandparentId;
  }

  const userDoc = await db.collection('users').doc(auth.username).get();
  const name = userDoc.exists ? userDoc.data().name || null : null;

  // A client-supplied clientId becomes the doc id itself, so a retried
  // request (server processed, client never saw the response) collides
  // atomically on create() instead of racing a read-then-write check.
  const commentRef = clientId ? itemsRef.doc(clientId) : itemsRef.doc();

  try {
    await commentRef.create({
      username: auth.username,
      name,
      text: commentText,
      parentId: parentId || null,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    if (clientId && (err.code === 6 || err.code === 'already-exists')) {
      const existing = await commentRef.get();
      const data = existing.data();
      return res.status(200).json({
        message: 'Comment added',
        comment: {
          id: existing.id,
          username: data.username,
          name: data.name || null,
          text: data.text,
          parentId: data.parentId || null,
          timestamp: toMillis(data.timestamp) || Date.now(),
          likes_count: data.likes_count || 0,
          likedByMe: false,
        },
        comments_count: postDoc.data().comments_count || 0,
      });
    }
    throw err;
  }
  await postRef.set({ comments_count: FieldValue.increment(1) }, { merge: true });

  const actorName = name || (await resolveDisplayName(db, auth.username));
  const snippet = commentText.length > 80 ? `${commentText.slice(0, 80)}…` : commentText;
  if (replyToUsername) {
    await sendInteractionNotification({
      recipientUsername: replyToUsername,
      actorUsername: auth.username,
      title: 'New reply',
      body: `${actorName} replied to your comment: ${snippet}`,
      data: { type: 'reply', postId: validPostId, collection: collectionName },
    });
  } else {
    await sendInteractionNotification({
      recipientUsername: postDoc.data().username,
      actorUsername: auth.username,
      title: 'New comment',
      body: `${actorName} commented: ${snippet}`,
      data: { type: 'comment', postId: validPostId, collection: collectionName },
    });
  }

  const newCount = (postDoc.data().comments_count || 0) + 1;
  res.status(200).json({
    message: 'Comment added',
    comment: {
      id: commentRef.id,
      username: auth.username,
      name,
      text: commentText,
      parentId: parentId || null,
      timestamp: Date.now(),
      likes_count: 0,
      likedByMe: false,
    },
    comments_count: newCount,
  });
}

// =========================================================================
// 🛠️ BACKEND INJECTION: AUTOMATED LAZY-HEALING INTERCEPTOR
// =========================================================================
// This checks if the user's active login token email matches a historical like
// under an old username, and automatically updates the database to their new handle!
async function checkAndHealUserLikeByEmail(db, postId, authSession) {
  if (!postId || !authSession || !authSession.email) return;

  const userEmail = authSession.email.toLowerCase();
  const currentUsername = authSession.username; // Their true, new username handle

  // Scan the post's sub-collection for a document that matches this email but has a different ID
  const historicLikeSnapshot = await db.collection('post_likes')
    .doc(postId)
    .collection('users')
    .where('email', '==', userEmail)
    .get();

  if (!historicLikeSnapshot.empty) {
    historicLikeSnapshot.forEach(async (doc) => {
      // If the document ID matches an old username (like 'rosh') instead of their current handle, migrate it!
      if (doc.id !== currentUsername) {
        const batch = db.batch();
        const newLikeRef = db.collection('post_likes').doc(postId).collection('users').doc(currentUsername);
        
        // Prepare the payload data, falling back to a safe timestamp structure
        const existingData = doc.data() || {};
        existingData.email = userEmail;
        if (!existingData.timestamp) existingData.timestamp = new Date().toISOString();

        batch.set(newLikeRef, existingData);
        batch.delete(doc.ref); // Delete the old 'rosh' node marker completely
        
        await batch.commit();
        console.log(`>>> Automatically self-healed legacy like for post ${postId}: ${doc.id} -> ${currentUsername} <<<`);
      }
    });
  }
}

// =========================================================================
// 🛠️ CONTEXT INJECTION: INTEGRATING FIX 2 INTO YOUR ACTIVE CODE
// =========================================================================
async function handleLikes(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const postId = validatePostId(req.query.postId);
  if (!postId) {
    return res.status(400).json({ error: 'Valid postId is required' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  // 🛠️ CALL THE SELF-HEAL TRIGGER ROUTINE HERE
  // This executes silently behind the scenes right when the user opens the post view arrays!
  try {
    const db = getFirestore(); // Ensure db is accessible in your file scope
    await checkAndHealUserLikeByEmail(db, postId, auth);
  } catch (err) {
    console.error('Background lazy-like healing pass failed safely:', err.message);
  }

  const authorUsername = await resolvePostAuthor(postId);
  if (!authorUsername) {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (!(await userFollows(auth.username, authorUsername))) {
    return res.status(403).json({ error: 'Follow this user to view their posts' });
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

  if (!(await userFollows(auth.username, postDoc.data().username || null))) {
    return res.status(403).json({ error: 'Follow this user to interact with their posts' });
  }

  const likeRef = db.collection('post_likes').doc(validPostId).collection('users').doc(auth.username);
  const existing = await likeRef.get();
  let count = postDoc.data().likes_count || 0;
  if (!existing.exists) {
    await likeRef.set({ timestamp: FieldValue.serverTimestamp() });
    await postRef.set({ likes_count: FieldValue.increment(1) }, { merge: true });
    count += 1;

    const authorName = await resolveDisplayName(db, auth.username);
    await sendInteractionNotification({
      recipientUsername: postDoc.data().username,
      actorUsername: auth.username,
      title: 'New like',
      body: `${authorName} liked your post`,
      data: { type: 'like', postId: validPostId, collection: collectionName },
    });
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

  const auth = await requireAuth(req, res);
  if (!auth) return;

  // Self may always read their own logs; otherwise the viewer must follow the
  // target. Check existence before follow state (404 before 403), mirroring the
  // follow-gate precedence used by handleComments.
  if (auth.username !== username) {
    const targetDoc = await db.collection('users').doc(username).get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!(await userFollows(auth.username, username))) {
      return res.status(403).json({ error: 'Follow this user to view their posts' });
    }
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

  // Strict privacy gate: interacting (including unliking) requires currently
  // following the author. A former follower who unfollows loses all access to
  // the post; their old like stays put until they follow again.
  if (!(await userFollows(auth.username, postDoc.data().username || null))) {
    return res.status(403).json({ error: 'Follow this user to interact with their posts' });
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

async function handleLikeComment(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, postId, commentId } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validPostId = validatePostId(postId);
  const validCommentId = validatePostId(commentId);
  if (!validPostId || !validCommentId) {
    return res.status(400).json({ error: 'Valid postId and commentId are required' });
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

  const postAuthor = await resolvePostAuthor(validPostId);
  if (!postAuthor) {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (!(await userFollows(auth.username, postAuthor))) {
    return res.status(403).json({ error: 'Follow this user to interact with their posts' });
  }

  const likeRef = commentLikeRef(validCommentId, auth.username);
  const existing = await likeRef.get();
  let count = commentDoc.data().likes_count || 0;
  if (!existing.exists) {
    await likeRef.set({ timestamp: FieldValue.serverTimestamp() });
    await commentRef.set({ likes_count: FieldValue.increment(1) }, { merge: true });
    count += 1;

    const likerName = await resolveDisplayName(db, auth.username);
    await sendInteractionNotification({
      recipientUsername: commentDoc.data().username,
      actorUsername: auth.username,
      title: 'New like',
      body: `${likerName} liked your comment`,
      data: { type: 'commentLike', postId: validPostId },
    });
  }
  res.status(200).json({ message: 'Liked', likes_count: count, likedByMe: true });
}

async function handleUnlikeComment(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, postId, commentId } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validPostId = validatePostId(postId);
  const validCommentId = validatePostId(commentId);
  if (!validPostId || !validCommentId) {
    return res.status(400).json({ error: 'Valid postId and commentId are required' });
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

  const authorUsername = await resolvePostAuthor(validPostId);
  if (!authorUsername) {
    return res.status(404).json({ error: 'Post not found' });
  }
  // Strict privacy gate: interacting (including unliking) requires currently
  // following the author. A former follower who unfollows loses all access to
  // the post; their old like stays put until they follow again.
  if (!(await userFollows(auth.username, authorUsername))) {
    return res.status(403).json({ error: 'Follow this user to interact with their posts' });
  }

  const likeRef = commentLikeRef(validCommentId, auth.username);
  const existing = await likeRef.get();

  let count = commentDoc.data().likes_count || 0;
  if (existing.exists) {
    await likeRef.delete();
    // Guard against going negative if counters ever drift.
    if (count > 0) {
      await commentRef.set({ likes_count: FieldValue.increment(-1) }, { merge: true });
      count -= 1;
    }
  }
  res.status(200).json({ message: 'Unliked', likes_count: count, likedByMe: false });
}

async function handleAcceptFollowRequest(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, fromUsername, from_username } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const fromUser = normalizeUsername(fromUsername || from_username);
  if (!fromUser) {
    return res.status(400).json({ error: 'Valid fromUsername is required' });
  }

  const { requestRef, outgoingRef, notificationRef } = followRequestRefs(fromUser, auth.username);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists || requestDoc.data().status !== 'pending') {
    return res.status(404).json({ error: 'Follow request not found' });
  }

  const followingRef = db
    .collection('following')
    .doc(fromUser)
    .collection('user_following')
    .doc(auth.username);
  const existingFollow = await followingRef.get();
  if (!existingFollow.exists) {
    await establishFollowRelationship(fromUser, auth.username);
  }

  const timestamp = FieldValue.serverTimestamp();
  await Promise.all([
    requestRef.set({ status: 'accepted', acceptedAt: timestamp }, { merge: true }),
    outgoingRef.delete(),
    notificationRef.set({ status: 'accepted', read: true, acceptedAt: timestamp }, { merge: true }),
  ]);

  const accepterName = await resolveDisplayName(db, auth.username);
  await sendInteractionNotification({
    recipientUsername: fromUser,
    actorUsername: auth.username,
    title: 'Follow request accepted',
    body: `${accepterName} accepted your follow request`,
    data: { type: 'follow_accepted', fromUsername: auth.username },
  });

  res.status(200).json({ message: 'Follow request accepted', fromUsername: fromUser });
}

async function handleDeclineFollowRequest(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, fromUsername, from_username } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const fromUser = normalizeUsername(fromUsername || from_username);
  if (!fromUser) {
    return res.status(400).json({ error: 'Valid fromUsername is required' });
  }

  const { requestRef, notificationRef } = followRequestRefs(fromUser, auth.username);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists || requestDoc.data().status !== 'pending') {
    return res.status(404).json({ error: 'Follow request not found' });
  }

  const timestamp = FieldValue.serverTimestamp();
  const { outgoingRef } = followRequestRefs(fromUser, auth.username);
  await Promise.all([
    requestRef.delete(),
    outgoingRef.delete(),
    notificationRef.set(
      { status: 'declined', read: true, declinedAt: timestamp },
      { merge: true }
    ),
  ]);

  res.status(200).json({ message: 'Follow request declined' });
}

async function handleNotifications(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (auth.username !== username) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let snapshot;
  try {
    snapshot = await db
      .collection('notifications')
      .doc(username)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
  } catch (orderErr) {
    console.log('notifications orderBy unavailable, falling back:', orderErr.message);
    snapshot = await db.collection('notifications').doc(username).collection('items').limit(50).get();
  }

  const notifications = [];
  let unreadCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const createdAt = toMillis(data.createdAt);
    if (!data.read) unreadCount += 1;
    notifications.push({
      id: doc.id,
      type: data.type || 'follow_request',
      fromUsername: data.fromUsername || doc.id,
      fromName: data.fromName || data.fromUsername || doc.id,
      read: !!data.read,
      status: data.status || 'pending',
      createdAt,
      requestId: data.requestId || doc.id,
    });
  }

  notifications.sort((a, b) => b.createdAt - a.createdAt);

  res.status(200).json({ notifications, unreadCount });
}

async function handleSentFollowRequests(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (auth.username !== username) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const snapshot = await db
    .collection('follow_requests_outgoing')
    .doc(username)
    .collection('pending')
    .get();

  const pending = snapshot.docs.map((doc) => ({
    username: doc.id,
    createdAt: toMillis(doc.data().createdAt) || null,
  }));

  res.status(200).json({ pending });
}

async function handleRegisterPushToken(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, token } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Valid Expo push token is required' });
  }

  const stored = await storePushToken(db, auth.username, token);
  if (!stored) {
    return res.status(400).json({ error: 'Invalid Expo push token' });
  }

  res.status(200).json({ message: 'Push token registered' });
}

async function handleUnregisterPushToken(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, token } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Valid Expo push token is required' });
  }

  await removePushToken(db, auth.username, token);
  res.status(200).json({ message: 'Push token removed' });
}

// "Recook" is a private, client-side action (the recipe is added to the
// actor's local Cook Next queue). There is nothing to persist server-side; this
// action exists solely to notify the post's author that someone re-cooked their
// recipe. It is best-effort and never required for the recook itself to work.
async function handleRecook(req, res) {
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

  const authorUsername = await resolvePostAuthor(validPostId, collectionName);
  if (!authorUsername) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const actorName = await resolveDisplayName(db, auth.username);
  await sendInteractionNotification({
    recipientUsername: authorUsername,
    actorUsername: auth.username,
    title: 'Recipe re-cooked',
    body: `${actorName} re-cooked your recipe`,
    data: { type: 'recook', postId: validPostId, collection: collectionName },
  });

  res.status(200).json({ message: 'ok' });
}
const handlers = {
  follow: handleFollow,
  unfollow: handleUnfollow,
  followers: handleFollowers,
  following: handleFollowing,
  feed: handleFeed,
  login: handleLogin,
  signinemail: handleSignInEmail,
  searchusers: handleSearchUsers,
  recommendedfollows: handleRecommendedFollows,
  checkemail: handleCheckEmail,
  checkusername: handleCheckUsername,
  postdetail: handlePostDetail,
  comments: handleComments,
  addcomment: handleAddComment,
  deletecomment: handleDeleteComment,
  likes: handleLikes,
  like: handleLike,
  likecomment: handleLikeComment,
  unlikecomment: handleUnlikeComment,
  unlike: handleUnlike,
  userlogs: handleUserLogs,
  portfoliofavorites: handlePortfolioFavorites,
  acceptfollowrequest: handleAcceptFollowRequest,
  declinefollowrequest: handleDeclineFollowRequest,
  notifications: handleNotifications,
  sentfollowrequests: handleSentFollowRequests,
  registerpushtoken: handleRegisterPushToken,
  unregisterpushtoken: handleUnregisterPushToken,
  recook: handleRecook,
      // Overwrite your cleansocial function block inside api/social.js with this complete migration setup:
  cleansocial: async (req, res) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
      const db = getFirestore();
      const batch = db.batch();
      const now = new Date().toISOString();

      // =========================================================================
      // 🛠️ CONFIGURATION: SET YOUR TARGETS EXPLICITLY
      // =========================================================================
      const oldTarget = "rosh";
      const ghostTarget = "ocean_roshan7"; // To clean up any accidental placeholder records
      
      // REPLACE WITH YOUR EXACT TRUE NEW USERNAME HANDLE ID STRING (lowercase)
      const myTrueNewUsername = "ocean_roshan7".trim().toLowerCase(); 
      // =========================================================================

      let totalMigratedCount = 0;

      // 1. MIGRATE "ai_suggestions" & "ai_usage" & "meal_plans" TOP-LEVEL DOCUMENTS
      // These collections are keyed directly by the username as the Document ID string.
      const targetCollections = ['ai_suggestions', 'ai_usage', 'meal_plans'];
      for (const colName of targetCollections) {
        // Process old 'rosh' document
        const oldDocRef = db.collection(colName).doc(oldTarget);
        const oldDoc = await oldDocRef.get();
        if (oldDoc.exists) {
          const newDocRef = db.collection(colName).doc(myTrueNewUsername);
          batch.set(newDocRef, oldDoc.data() || {});
          batch.delete(oldDocRef);
          totalMigratedCount++;
        }

        // Process any accidental ghost placeholder documents
        const ghostDocRef = db.collection(colName).doc(ghostTarget);
        const ghostDoc = await ghostDocRef.get();
        if (ghostDoc.exists) {
          const newDocRef = db.collection(colName).doc(myTrueNewUsername);
          batch.set(newDocRef, ghostDoc.data() || {}, { merge: true });
          batch.delete(ghostDocRef);
          totalMigratedCount++;
        }
      }

      // 2. MIGRATE "post_comments" VIA FIELD FILTERS
      // Comments use random IDs, but contain a 'username' text field property inside them.
      const commentsSnapshot = await db.collection('post_comments')
        .where('username', 'in', [oldTarget, ghostTarget])
        .get();
      
      commentsSnapshot.forEach((commentDoc) => {
        batch.update(commentDoc.ref, { username: myTrueNewUsername });
        totalMigratedCount++;
      });

      // 3. MIGRATE LINGERING "post_likes" & "comment_likes" SUB-COLLECTIONS
      const allSocialDocsSnapshot = await db.collectionGroup('users').get();
      allSocialDocsSnapshot.forEach((doc) => {
        const isLegacyMatch = doc.id === oldTarget || doc.id === ghostTarget;
        if (isLegacyMatch) {
          const path = doc.ref.path;
          
          if (path.includes('post_likes')) {
            const parts = path.split('/');
            const postId = parts[parts.length - 3];
            const newRef = db.collection('post_likes').doc(postId).collection('users').doc(myTrueNewUsername);
            batch.set(newRef, doc.data() || { timestamp: now });
            batch.delete(doc.ref);
            totalMigratedCount++;
          }
          
          if (path.includes('comment_likes')) {
            const parts = path.split('/');
            const commentId = parts[parts.length - 3];
            const newRef = db.collection('comment_likes').doc(commentId).collection('users').doc(myTrueNewUsername);
            batch.set(newRef, doc.data() || { timestamp: now });
            batch.delete(doc.ref);
            totalMigratedCount++;
          }
        }
      });

      // Commit the unified database transaction
      await batch.commit();
      
      console.log(`>>> Full-stack username migration complete! Processed ${totalMigratedCount} records over to ${myTrueNewUsername} <<<`);
      return res.status(200).json({ 
        status: 'success', 
        message: `Successfully transferred all suggestions, usage metrics, meal plans, comments, and historic likes directly to '${myTrueNewUsername}'!`,
        totalRecordsProcessed: totalMigratedCount
      });
      
    } catch (err) {
      console.error('Unified handle migration pass failed:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  } 
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
    res.status(500).json({
      error: `Failed to handle action "${action}"`,
      ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
    });
  }
};
