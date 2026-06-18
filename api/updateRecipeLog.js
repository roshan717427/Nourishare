const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { validatePostId, sanitizeLogUpdates } = require('./_helpers/validateInput');

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
    return res.status(405).send('Method Not Allowed');
  }

  if (!db) {
    return res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
  }

  const auth = await requireAuthForUsername(req, res, req.body.username);
  if (!auth) return;

  const logId = validatePostId(req.body.logId);
  if (!logId) {
    return res.status(400).json({ error: 'Valid logId is required' });
  }

  const filteredUpdates = sanitizeLogUpdates(req.body.updates);
  if (!filteredUpdates) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const logRef = db.collection('logs').doc(logId);
    const doc = await logRef.get();

    if (!doc.exists || doc.data().username !== auth.username) {
      return res.status(404).json({ error: 'Log not found or access denied' });
    }

    await logRef.update({
      ...filteredUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: 'Recipe log updated' });
  } catch (error) {
    console.error('Error updating log:', error);
    return res.status(500).json({
      error: 'Failed to update recipe log',
      details: error.message,
    });
  }
};
