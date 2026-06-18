const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { pickProfileUpdates } = require('./_helpers/validateInput');
const { capitalizeList } = require('../utils/titleCase');

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
  if (req.method !== 'PATCH') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const normalizeProfileUpdates = (updates) => {
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

  const auth = await requireAuthForUsername(req, res, req.body.username);
  if (!auth) return;

  const { username, ...rawUpdates } = req.body;
  const updates = pickProfileUpdates(normalizeProfileUpdates(rawUpdates));
  if (!updates) {
    res.status(400).json({ error: 'Invalid profile update fields' });
    return;
  }

  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  try {
    const userRef = db.collection('users').doc(auth.username);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (updates.kitchen_personality) {
      const existing = userDoc.data().kitchen_personality || {};
      updates.kitchen_personality = { ...existing, ...updates.kitchen_personality };

      if (Array.isArray(updates.kitchen_personality.top_cuisines)) {
        updates.kitchen_personality.top_cuisines = capitalizeList(
          updates.kitchen_personality.top_cuisines
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 3)
        );
      }
      if (Array.isArray(updates.kitchen_personality.favorite_ingredients)) {
        updates.kitchen_personality.favorite_ingredients = capitalizeList(
          updates.kitchen_personality.favorite_ingredients
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        );
      }
    }

    if (updates.kitchen_personality && updates.personality_edited_by_user !== false) {
      updates.personality_edited_by_user = true;
    }

    await userRef.update(updates);
    res.status(200).json({ message: 'User profile updated' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update user profile',
      details: error.message,
    });
  }
};
