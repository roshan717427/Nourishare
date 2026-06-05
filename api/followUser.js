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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const { username, targetUsername, target_username } = req.body;
  const targetUser = targetUsername || target_username;

  if (!username || !targetUser) {
    res.status(400).json({ error: 'Username and targetUsername are required' });
    return;
  }

  if (username === targetUser) {
    res.status(400).json({ error: 'Cannot follow yourself' });
    return;
  }

  try {
    const userRef = db.collection('users').doc(username);
    const targetRef = db.collection('users').doc(targetUser);

    const [userDoc, targetDoc] = await Promise.all([userRef.get(), targetRef.get()]);
    if (!userDoc.exists || !targetDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
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
      res.status(400).json({ error: 'Already following this user' });
      return;
    }

    const timestamp = FieldValue.serverTimestamp();
    await Promise.all([
      followingRef.set({ timestamp }),
      followersRef.set({ timestamp })
    ]);

    res.status(200).json({ message: `Now following ${targetUser}` });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      error: 'Failed to follow user',
      details: error.message
    });
  }
};
