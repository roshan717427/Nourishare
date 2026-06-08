const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { refreshUserPersonality } = require('./personalityHelper');

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

  const { username, logId } = req.body;

  if (!username || !logId) {
    return res.status(400).json({ error: 'username and logId are required' });
  }

  try {
    const logRef = db.collection('logs').doc(logId);
    const doc = await logRef.get();

    if (!doc.exists || doc.data().username !== username) {
      return res.status(404).json({ error: 'Log not found or access denied' });
    }

    await logRef.delete();

    // Remove from portfolio favorites if showcased.
    try {
      const userRef = db.collection('users').doc(username);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const favorites = userDoc.data().portfolio_favorites || [];
        if (favorites.includes(logId)) {
          await userRef.update({
            portfolio_favorites: favorites.filter((id) => id !== logId),
          });
        }
      }
    } catch (favErr) {
      console.error('Failed to update portfolio favorites after delete:', favErr.message);
    }

    // Best-effort counter decrement; getUserProfile recomputes from logs.
    try {
      await db
        .collection('users')
        .doc(username)
        .set(
          { cookingStats: { total_recipes: FieldValue.increment(-1) } },
          { merge: true }
        );
    } catch (counterErr) {
      console.error('Failed to decrement user recipe counter:', counterErr.message);
    }

    try {
      await refreshUserPersonality(db, username);
    } catch (personalityErr) {
      console.error('Failed to refresh kitchen personality:', personalityErr.message);
    }

    return res.status(200).json({ message: 'Recipe log deleted' });
  } catch (error) {
    console.error('Error deleting log:', error);
    return res.status(500).json({ 
      error: 'Failed to delete recipe log',
      details: error.message 
    });
  }
};
