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
  
  const {
    username,
    title,
    photoUrl,
    ingredients,
    recipeLink,
    notes,
    rating,
    difficulty,
    time,
    source
  } = req.body;

  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  
  if (!title) {
    res.status(400).json({ error: 'Title (name of the dish) is required' });
    return;
  }

  try {
    // Filter out undefined values before saving to Firestore
    const logData = {
      username,
      title,
      photoUrl,
      ingredients,
      recipeLink,
      notes,
      rating,
      difficulty,
      time,
      source,
      createdAt: FieldValue.serverTimestamp()
    };
    
    // Remove undefined values
    Object.keys(logData).forEach(key => {
      if (logData[key] === undefined) {
        delete logData[key];
      }
    });
    
    const docRef = await db.collection('logs').add(logData);
    res.status(201).json({ message: 'Recipe log created', logId: docRef.id });
  } catch (error) {
    console.error('Error creating recipe log:', error);
    res.status(500).json({ 
      error: 'Failed to create recipe log',
      details: error.message 
    });
  }
};
