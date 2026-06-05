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
      .orderBy('timestamp', 'desc')
      .get();

    const following = [];
    for (const followedDoc of followingSnapshot.docs) {
      const followedId = followedDoc.id;
      const followedData = await db.collection('users').doc(followedId).get();
      following.push({
        username: followedId,
        name: followedData.exists ? followedData.data().name : undefined,
        timestamp: followedDoc.data().timestamp || null
      });
    }

    res.status(200).json({ following });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({
      error: 'Failed to fetch following',
      details: error.message
    });
  }
};
