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

  const { username, logId } = req.body;

  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  try {
    if (logId) {
      // Return a single log by ID
      const doc = await db.collection('logs').doc(logId).get();
      if (!doc.exists || doc.data().username !== username) {
        return res.status(404).json({ error: 'Log not found or access denied' });
      }
      return res.status(200).json({ log: doc.data(), logId: doc.id });
    } else {
      // Return all logs for a user
      // Return all logs for a user
    let query = db.collection('logs').where('username', '==', username);

// Optionally add ordering only if you're sure createdAt is present
    try {
        query = query.orderBy('createdAt', 'desc');
    } catch (error) {
        console.warn('Skipping orderBy due to missing createdAt:', error);
    }

    const snapshot = await query.get();


      const logs = snapshot.docs.map(doc => ({ logId: doc.id, ...doc.data() }));
      return res.status(200).json({ logs });
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recipe logs',
      details: error.message 
    });
  }
};
