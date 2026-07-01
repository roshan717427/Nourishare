const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { normalizeUsername, validatePostId } = require('./_helpers/validateInput');

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

  const username = normalizeUsername(req.body.username);
  if (!username) {
    res.status(400).json({ error: 'Valid username is required' });
    return;
  }

  // Both the single-log and the full-list path return a user's private logs, so
  // gate the whole endpoint to the owner (the single-log path always required
  // this; the list path previously did not).
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  try {
    const logId = validatePostId(req.body.logId);
    if (logId) {
      const doc = await db.collection('logs').doc(logId).get();
      if (!doc.exists || doc.data().username !== auth.username) {
        return res.status(404).json({ error: 'Log not found or access denied' });
      }
      return res.status(200).json({ log: doc.data(), logId: doc.id });
    }

    let query = db.collection('logs').where('username', '==', username);
    try {
      query = query.orderBy('createdAt', 'desc');
    } catch (error) {
      console.warn('Skipping orderBy due to missing createdAt:', error);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map((doc) => ({ logId: doc.id, ...doc.data() }));
    return res.status(200).json({ logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      error: 'Failed to fetch recipe logs',
      ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
    });
  }
};
