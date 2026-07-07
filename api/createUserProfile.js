const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  normalizeUsername,
  sanitizeText,
  validateEmail,
  validatePersonName,
  validateUrl,
} = require('./_helpers/validateInput');

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

  const { requireToken } = require('./_helpers/verifyAuth');

  const auth = await requireToken(req, res);
  if (!auth) return;

  const username = normalizeUsername(req.body.username);
  if (!username) {
    res.status(400).json({ error: 'Invalid username' });
    return;
  }

  const email = validateEmail(req.body.email);
  if (!email) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }
  if (auth.email && email !== auth.email.toLowerCase()) {
    res.status(403).json({ error: 'Email does not match authenticated account' });
    return;
  }

  const firstName = validatePersonName(req.body.firstName);
  const lastName = validatePersonName(req.body.lastName);
  if (!firstName || !lastName) {
    res.status(400).json({ error: 'First and last name must contain letters only (A–Z)' });
    return;
  }

  function capitalizeFirst(value) {
    const v = String(value || '').trim();
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  }

  const capitalFirst = capitalizeFirst(firstName);
  const capitalLast = capitalizeFirst(lastName);
  const displayName = `${capitalFirst} ${capitalLast}`;

  const userData = {
    username,
    uid: auth.uid,
    createdAt: new Date().toISOString(),
    name: displayName,
    nameLower: displayName.toLowerCase(),
    firstName: capitalFirst,
    lastName: capitalLast,
    email,
    bio: sanitizeText(req.body.bio, 500) || undefined,
    profilePhotoUrl: validateUrl(req.body.profilePhotoUrl ?? req.body.profile_photo_url),
    kitchenPersona: sanitizeText(req.body.kitchenPersona ?? req.body.kitchen_persona, 100) || undefined,
    topDishes: Array.isArray(req.body.topDishes ?? req.body.top_dishes)
      ? (req.body.topDishes ?? req.body.top_dishes)
          .map((item) => sanitizeText(item, 100))
          .filter(Boolean)
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
    const uidSnapshot = await db
      .collection('users')
      .where('uid', '==', auth.uid)
      .limit(1)
      .get();
    const existingUsernameDoc = await db.collection('users').doc(username).get();

    if (!uidSnapshot.empty) {
      const existingUserDoc = uidSnapshot.docs[0];
      const existingUserData = existingUserDoc.data() || {};

      if (existingUserDoc.id === username) {
        await existingUserDoc.ref.set({ ...existingUserData, ...userData }, { merge: true });
        res.status(200).json({ message: 'User profile updated', username });
        return;
      }

      if (existingUsernameDoc.exists && existingUsernameDoc.data()?.uid !== auth.uid) {
        res.status(409).json({ error: 'User profile already exists' });
        return;
      }

      const batch = db.batch();
      batch.delete(existingUserDoc.ref);
      batch.set(db.collection('users').doc(username), {
        ...existingUserData,
        ...userData,
      });
      await batch.commit();
      res.status(200).json({ message: 'User profile updated', username });
      return;
    }

    if (existingUsernameDoc.exists) {
      if (existingUsernameDoc.data()?.uid !== auth.uid) {
        res.status(409).json({ error: 'User profile already exists' });
        return;
      }

      await existingUsernameDoc.ref.set({ ...existingUsernameDoc.data(), ...userData }, { merge: true });
      res.status(200).json({ message: 'User profile updated', username });
      return;
    }

    await db.collection('users').doc(username).set(userData);
    res.status(201).json({ message: 'User profile created', username });
  } catch (error) {
    console.error('Error creating user profile:', error);
    res.status(500).json({
      error: 'Failed to create user profile',
      ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
    });
  }
};
