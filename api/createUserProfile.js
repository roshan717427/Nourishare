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
  
  const {
    username,
    name,
    email,
    bio,
    profilePhotoUrl,
    kitchenPersona,
    topDishes,
    favoriteIngredients,
    cookingStats
  } = req.body;

  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  try {
    // Filter out undefined values before saving to Firestore
    const userData = {
      username,
      name,
      email,
      bio,
      profilePhotoUrl,
      kitchenPersona,
      topDishes,
      favoriteIngredients,
      cookingStats
    };
    
    // Remove undefined values
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });
    
    await db.collection('users').doc(username).set(userData);
    res.status(201).json({ message: 'User profile created', username });
  } catch (error) {
    console.error('Error creating user profile:', error);
    res.status(500).json({ 
      error: 'Failed to create user profile',
      details: error.message 
    });
  }
};
