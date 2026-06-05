const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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
  const targetUser = targetUsername || target_username;

  if (!username || !targetUser) {
    return res.status(400).json({ error: 'Username and targetUsername are required' });
  }
  if (username === targetUser) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  const userRef = db.collection('users').doc(username);
  const targetRef = db.collection('users').doc(targetUser);
  const [userDoc, targetDoc] = await Promise.all([userRef.get(), targetRef.get()]);
  if (!userDoc.exists || !targetDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const followingRef = db
    .collection('following')
    .doc(username)
    .collection('user_following')
    .doc(targetUser);
  const followersRef = db
    .collection('followers')
    .doc(targetUser)
    .collection('user_followers')
    .doc(username);

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
  const targetUser = targetUsername || target_username;

  if (!username || !targetUser) {
    return res.status(400).json({ error: 'Username and targetUsername are required' });
  }

  const userRef = db.collection('users').doc(username);
  const targetRef = db.collection('users').doc(targetUser);
  const [userDoc, targetDoc] = await Promise.all([userRef.get(), targetRef.get()]);
  if (!userDoc.exists || !targetDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
  }

  const followingRef = db
    .collection('following')
    .doc(username)
    .collection('user_following')
    .doc(targetUser);
  const followersRef = db
    .collection('followers')
    .doc(targetUser)
    .collection('user_followers')
    .doc(username);

  const existing = await followingRef.get();
  if (!existing.exists) {
    return res.status(400).json({ error: 'Not following this user' });
  }

  await Promise.all([followingRef.delete(), followersRef.delete()]);
  res.status(200).json({ message: `Unfollowed ${targetUser}` });
}

async function handleFollowers(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
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

  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
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

async function handleFeed(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
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

  const chunkSize = 10;
  const chunks = [];
  for (let i = 0; i < followedUsers.length; i += chunkSize) {
    chunks.push(followedUsers.slice(i, i + chunkSize));
  }

  const posts = [];
  for (const chunk of chunks) {
    const snapshot = await db
      .collection('recipe_posts')
      .where('username', 'in', chunk)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    snapshot.forEach(doc => {
      posts.push({ id: doc.id, ...doc.data() });
    });
  }

  posts.sort((a, b) => {
    const aTime = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
    const bTime = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
    return bTime - aTime;
  });

  const trimmedPosts = posts.slice(0, 50);
  const uniqueUsernames = [...new Set(trimmedPosts.map(post => post.username))];
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
  if (!username && !email) {
    return res.status(400).json({ error: 'Username or email is required' });
  }

  let userDoc;
  if (username) {
    userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
  } else {
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    userDoc = snapshot.docs[0];
  }

  const userData = userDoc.data();
  res.status(200).json({ ...userData, username: userData.username || userDoc.id });
}

const handlers = {
  follow: handleFollow,
  unfollow: handleUnfollow,
  followers: handleFollowers,
  following: handleFollowing,
  feed: handleFeed,
  login: handleLogin
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
