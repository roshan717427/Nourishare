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
  if (req.method !== 'DELETE') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }
  
  const { username } = req.body;
  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  try {
    await db.collection('users').doc(username).delete();
    res.status(200).json({ message: 'User profile deleted' });
  } catch (error) {
    console.error('Error deleting user profile:', error);
    res.status(500).json({ 
      error: 'Failed to delete user profile',
      details: error.message 
    });
  }
};
