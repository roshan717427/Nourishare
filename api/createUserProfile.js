const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { normalizeUsername, sanitizeText, validateEmail, validatePersonName, validateUrl } = require('./_helpers/validateInput');

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

  const auth = await requireAuthForUsername(req, res, req.body.username);
  if (!auth) return;

  const email = validateEmail(req.body.email);
  if (!email) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  const firstName = validatePersonName(req.body.firstName);
  const lastName = validatePersonName(req.body.lastName);
  if (!firstName || !lastName) {
    res.status(400).json({ error: 'First and last name must contain letters only (A–Z)' });
    return;
  }

  const userData = {
    username: auth.username,
    uid: auth.uid,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email,
    bio: sanitizeText(req.body.bio, 500) || undefined,
    profilePhotoUrl: validateUrl(req.body.profilePhotoUrl ?? req.body.profile_photo_url),
    kitchenPersona: sanitizeText(req.body.kitchenPersona ?? req.body.kitchen_persona, 100) || undefined,
    topDishes: Array.isArray(req.body.topDishes ?? req.body.top_dishes)
      ? (req.body.topDishes ?? req.body.top_dishes).map((item) => sanitizeText(item, 100)).filter(Boolean)
      : undefined,
    favoriteIngredients: Array.isArray(req.body.favoriteIngredients ?? req.body.favorite_ingredients)
      ? (req.body.favoriteIngredients ?? req.body.favorite_ingredients)
          .map((item) => sanitizeText(item, 100))
          .filter(Boolean)
      : undefined,
    cookingStats:
      req.body.cookingStats ?? req.body.cooking_stats
        ? req.body.cookingStats ?? req.body.cooking_stats
        : undefined,
  };

  Object.keys(userData).forEach((key) => {
    if (userData[key] === undefined) {
      delete userData[key];
    }
  });

  try {
    const existing = await db.collection('users').doc(auth.username).get();
    if (existing.exists) {
      res.status(409).json({ error: 'User profile already exists' });
      return;
    }

    await db.collection('users').doc(auth.username).set(userData);
    res.status(201).json({ message: 'User profile created', username: auth.username });
  } catch (error) {
    console.error('Error creating user profile:', error);
    res.status(500).json({
      error: 'Failed to create user profile',
      details: error.message,
    });
  }
};
