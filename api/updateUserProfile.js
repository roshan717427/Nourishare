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
  if (req.method !== 'PATCH') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }
  
  const normalizeProfileUpdates = updates => {
    const normalized = { ...updates };
    if (normalized.profile_photo_url !== undefined && normalized.profilePhotoUrl === undefined) {
      normalized.profilePhotoUrl = normalized.profile_photo_url;
    }
    if (normalized.kitchen_persona !== undefined && normalized.kitchenPersona === undefined) {
      normalized.kitchenPersona = normalized.kitchen_persona;
    }
    if (normalized.top_dishes !== undefined && normalized.topDishes === undefined) {
      normalized.topDishes = normalized.top_dishes;
    }
    if (normalized.favorite_ingredients !== undefined && normalized.favoriteIngredients === undefined) {
      normalized.favoriteIngredients = normalized.favorite_ingredients;
    }
    if (normalized.cooking_stats !== undefined && normalized.cookingStats === undefined) {
      normalized.cookingStats = normalized.cooking_stats;
    }

    delete normalized.profile_photo_url;
    delete normalized.kitchen_persona;
    delete normalized.top_dishes;
    delete normalized.favorite_ingredients;
    delete normalized.cooking_stats;

    return normalized;
  };

  const { username, ...rawUpdates } = req.body;
  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  
  const updates = normalizeProfileUpdates(rawUpdates);

  // Filter out undefined values before updating
  Object.keys(updates).forEach(key => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });
  
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }
  
  try {
    const userRef = db.collection('users').doc(username);
    await userRef.update(updates);
    res.status(200).json({ message: 'User profile updated' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      error: 'Failed to update user profile',
      details: error.message 
    });
  }
};
