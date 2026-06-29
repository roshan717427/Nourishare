const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { refreshUserPersonality } = require('./_helpers/personalityHelper');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { sanitizeRecipeLogFields } = require('./_helpers/validateInput');
const { resolveDisplayName, sendInteractionNotification } = require('./_helpers/notifications');

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

  const fields = sanitizeRecipeLogFields(req.body);

  if (!fields.title) {
    res.status(400).json({ error: 'Title (name of the dish) is required' });
    return;
  }
  if (!fields.ingredients) {
    res.status(400).json({ error: 'Ingredients are required' });
    return;
  }
  if (!fields.recipeInstructions && !fields.recipeLink) {
    res.status(400).json({ error: 'Recipe steps or link is required' });
    return;
  }
  if (fields.rating == null) {
    res.status(400).json({ error: 'Rating is required' });
    return;
  }
  if (!fields.difficulty) {
    res.status(400).json({ error: 'Difficulty is required' });
    return;
  }
  if (!fields.time) {
    res.status(400).json({ error: 'Time is required' });
    return;
  }

  try {
    const logData = {
      username: auth.username,
      title: fields.title,
      ingredients: fields.ingredients,
      recipeInstructions: fields.recipeInstructions,
      rating: fields.rating,
      difficulty: fields.difficulty,
      time: fields.time,
      createdAt: FieldValue.serverTimestamp(),
    };

    if (fields.photoUrl !== undefined) logData.photoUrl = fields.photoUrl;
    if (fields.recipeLink !== undefined) logData.recipeLink = fields.recipeLink;
    if (fields.notes) logData.notes = fields.notes;
    if (fields.dishType) logData.dishType = fields.dishType;
    if (fields.cookedWith.length > 0) logData.cookedWith = fields.cookedWith;

    const docRef = await db.collection('logs').add(logData);

    try {
      await db
        .collection('users')
        .doc(auth.username)
        .set(
          {
            cookingStats: { total_recipes: FieldValue.increment(1) },
          },
          { merge: true }
        );
    } catch (counterErr) {
      console.error('Failed to increment user recipe counter:', counterErr.message);
    }

    try {
      await refreshUserPersonality(db, auth.username);
    } catch (personalityErr) {
      console.error('Failed to refresh kitchen personality:', personalityErr.message);
    }

    if (fields.cookedWith.length > 0) {
      try {
        const taggerName = await resolveDisplayName(db, auth.username);
        await Promise.all(
          fields.cookedWith.map((taggedUsername) =>
            sendInteractionNotification({
              recipientUsername: taggedUsername,
              actorUsername: auth.username,
              title: 'You were tagged',
              body: `${taggerName} cooked a dish with you: ${fields.title}`,
              data: { type: 'tag', postId: docRef.id, collection: 'logs' },
            })
          )
        );
      } catch (tagErr) {
        console.error('Failed to send cookedWith tag notifications:', tagErr.message);
      }
    }

    res.status(201).json({ message: 'Recipe log created', logId: docRef.id });
  } catch (error) {
    console.error('Error creating recipe log:', error);
    res.status(500).json({
      error: 'Failed to create recipe log',
      details: error.message,
    });
  }
};
