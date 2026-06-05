const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const { username } = req.query;
  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const followingSnapshot = await db
      .collection('following')
      .doc(username)
      .collection('user_following')
      .get();

    const followedUsers = followingSnapshot.docs.map(doc => doc.id);
    if (followedUsers.length === 0) {
      res.status(200).json({ recipe_posts: [] });
      return;
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
        userMap[doc.id] = {
          username: doc.id,
          name: doc.data().name
        };
      }
    });

    const recipePosts = trimmedPosts.map(post => ({
      ...post,
      user: userMap[post.username] || { username: post.username }
    }));

    res.status(200).json({ recipe_posts: recipePosts });
  } catch (error) {
    console.error('Error fetching user feed:', error);
    res.status(500).json({
      error: 'Failed to fetch user feed',
      details: error.message
    });
  }
};
