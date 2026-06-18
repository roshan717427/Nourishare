const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { normalizeUsername } = require('./_helpers/validateInput');

let db;
let adminAuth;
try {
  if (!getApps().length) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set');
    }
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  db = getFirestore();
  adminAuth = getAuth();
} catch (error) {
  console.error('Firebase initialization error:', error);
}

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!db || !adminAuth) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const { username } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  try {
    const userRef = db.collection('users').doc(auth.username);
    const userDoc = await userRef.get();
    const profileEmail = userDoc.exists ? userDoc.data()?.email : null;

    await userRef.delete();

    let authUid = auth.uid;
    if (!authUid && profileEmail) {
      try {
        const authUser = await adminAuth.getUserByEmail(profileEmail);
        authUid = authUser.uid;
      } catch (lookupError) {
        if (lookupError.code !== 'auth/user-not-found') {
          throw lookupError;
        }
      }
    }

    if (authUid) {
      try {
        await adminAuth.deleteUser(authUid);
      } catch (deleteError) {
        if (deleteError.code !== 'auth/user-not-found') {
          throw deleteError;
        }
      }
    }

    res.status(200).json({ message: 'User profile deleted' });
  } catch (error) {
    console.error('Error deleting user profile:', error);
    res.status(500).json({
      error: 'Failed to delete user profile',
      details: error.message,
    });
  }
};
