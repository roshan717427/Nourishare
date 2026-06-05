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
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const { username, email } = req.body;
  if (!username && !email) {
    res.status(400).json({ error: 'Username or email is required' });
    return;
  }

  try {
    let userDoc;

    if (username) {
      userDoc = await db.collection('users').doc(username).get();
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
    } else {
      const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
      if (snapshot.empty) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      userDoc = snapshot.docs[0];
    }

    const userData = userDoc.data();
    res.status(200).json({
      ...userData,
      username: userData.username || userDoc.id
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      error: 'Failed to log in user',
      details: error.message
    });
  }
};
