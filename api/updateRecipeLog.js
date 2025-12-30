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
    return res.status(405).send('Method Not Allowed');
  }
  
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
  }

  const { username, logId, updates } = req.body;

  if (!username || !logId || !updates) {
    return res.status(400).json({ error: 'username, logId, and updates are required' });
  }
  
  // Filter out undefined values before updating
  const filteredUpdates = { ...updates };
  Object.keys(filteredUpdates).forEach(key => {
    if (filteredUpdates[key] === undefined) {
      delete filteredUpdates[key];
    }
  });
  
  if (Object.keys(filteredUpdates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const logRef = db.collection('logs').doc(logId);
    const doc = await logRef.get();

    if (!doc.exists || doc.data().username !== username) {
      return res.status(404).json({ error: 'Log not found or access denied' });
    }

    await logRef.update({
      ...filteredUpdates,
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ message: 'Recipe log updated' });
  } catch (error) {
    console.error('Error updating log:', error);
    return res.status(500).json({ 
      error: 'Failed to update recipe log',
      details: error.message 
    });
  }
};
