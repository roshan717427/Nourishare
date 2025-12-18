const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
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
    await db.collection('users').doc(username).set({
      username,
      name,
      email,
      bio,
      profilePhotoUrl,
      kitchenPersona,
      topDishes,
      favoriteIngredients,
      cookingStats
    });
    res.status(201).json({ message: 'User profile created', username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create user profile' });
  }
};
