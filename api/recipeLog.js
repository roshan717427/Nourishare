/**
 * Recipe log CRUD (the `logs` collection backing a user's own cooking history).
 *
 * Consolidated from createRecipeLog/getRecipeLog/updateRecipeLog/deleteRecipeLog
 * into one file (action-dispatched, same pattern as social.js/mealPlan.js) to
 * stay under the Vercel Hobby plan's 12-serverless-function limit.
 *
 * Actions (POST, case-insensitive via ?action=):
 *   - create  body { username, title, ingredients, rating, difficulty, time,
 *                     recipeInstructions?, recipeLink?, photoUrl?, notes?,
 *                     dishType?, cookedWith? }
 *             resp { message, logId }
 *   - update  body { username, logId, updates: {...} }
 *             resp { message }
 *   - delete  body { username, logId }
 *             resp { message }
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { refreshUserPersonality } = require('./_helpers/personalityHelper');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { validatePostId, sanitizeRecipeLogFields, sanitizeLogUpdates } = require('./_helpers/validateInput');
const { resolveDisplayName, sendInteractionNotification } = require('./_helpers/notifications');
const { partitionExistingUsernames } = require('./_helpers/userLookup');
const { assertCleanText } = require('./_helpers/contentSafety');
const { assertImageSafe } = require('./_helpers/imageSafety');
const { deletePostSocialTree } = require('./_helpers/deletePostSocialTree');

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

function methodNotAllowed(res) {
  res.status(405).send('Method Not Allowed');
}

async function handleCreate(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const auth = await requireAuthForUsername(req, res, req.body.username);
  if (!auth) return;

  const fields = sanitizeRecipeLogFields(req.body);

  try {
    assertCleanText(fields.title, { field: 'title', allowEmpty: false });
    assertCleanText(fields.ingredients, { field: 'ingredients', allowEmpty: false });
    if (fields.notes) assertCleanText(fields.notes, { field: 'notes' });
    if (fields.recipeInstructions) {
      assertCleanText(fields.recipeInstructions, { field: 'recipeInstructions' });
    }
    if (fields.photoUrl) await assertImageSafe(fields.photoUrl);
  } catch (safetyErr) {
    return res.status(safetyErr.status || 400).json({
      error: safetyErr.code || 'content_blocked',
      message: safetyErr.message,
    });
  }

  // After const fields = sanitizeRecipeLogFields(req.body);
  if (fields.cookedWith.length > 0) {
    const { existing, missing } = await partitionExistingUsernames(db, fields.cookedWith);
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Some tagged users were not found',
        invalid_usernames: missing,
      });
    }
    fields.cookedWith = existing;
  }

  if (!fields.title) {
    return res.status(400).json({ error: 'Title (name of the dish) is required' });
  }
  if (!fields.ingredients) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }
  if (fields.rating == null) {
    return res.status(400).json({ error: 'Rating is required' });
  }
  if (!fields.difficulty) {
    return res.status(400).json({ error: 'Difficulty is required' });
  }
  if (!fields.time) {
    return res.status(400).json({ error: 'Time is required' });
  }

  let authorName = auth.username;
  let authorProfilePhotoUrl = null;
  try {
    const authorDoc = await db.collection('users').doc(auth.username).get();
    if (authorDoc.exists) {
      const authorData = authorDoc.data() || {};
      authorName = authorData.name || auth.username;
      authorProfilePhotoUrl = authorData.profilePhotoUrl || null;
    }
  } catch (authorErr) {
    console.warn('Could not load author profile for denormalized fields:', authorErr.message);
  }

  const logData = {
    username: auth.username,
    // Denormalized for feed/home so clients can render without N+1 profile reads.
    name: authorName,
    profilePhotoUrl: authorProfilePhotoUrl,
    title: fields.title,
    ingredients: fields.ingredients,
    recipeInstructions: fields.recipeInstructions,
    rating: fields.rating,
    difficulty: fields.difficulty,
    time: fields.time,
    likes_count: 0,
    comments_count: 0,
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
      .set({ cookingStats: { total_recipes: FieldValue.increment(1) } }, { merge: true });
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
}

async function handleUpdate(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const auth = await requireAuthForUsername(req, res, req.body.username);
  if (!auth) return;

  const logId = validatePostId(req.body.logId);
  if (!logId) {
    return res.status(400).json({ error: 'Valid logId is required' });
  }

  const filteredUpdates = sanitizeLogUpdates(req.body.updates);
  if (!filteredUpdates) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  if (filteredUpdates.error) {
    return res.status(400).json({ error: filteredUpdates.error });
  }

  if (filteredUpdates.cookedWith !== undefined) {
    const { existing, missing } = await partitionExistingUsernames(
      db,
      filteredUpdates.cookedWith
    );
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Some tagged users were not found',
        invalid_usernames: missing,
      });
    }
    filteredUpdates.cookedWith = existing;
  }

  try {
    if (filteredUpdates.title != null) {
      assertCleanText(filteredUpdates.title, { field: 'title', allowEmpty: false });
    }
    if (filteredUpdates.ingredients != null) {
      assertCleanText(filteredUpdates.ingredients, { field: 'ingredients', allowEmpty: false });
    }
    if (filteredUpdates.notes != null) {
      assertCleanText(filteredUpdates.notes, { field: 'notes' });
    }
    if (filteredUpdates.recipeInstructions != null) {
      assertCleanText(filteredUpdates.recipeInstructions, { field: 'recipeInstructions' });
    }
    if (filteredUpdates.photoUrl) await assertImageSafe(filteredUpdates.photoUrl);
  } catch (safetyErr) {
    return res.status(safetyErr.status || 400).json({
      error: safetyErr.code || 'content_blocked',
      message: safetyErr.message,
    });
  }

  const logRef = db.collection('logs').doc(logId);
  const doc = await logRef.get();

  if (!doc.exists || doc.data().username !== auth.username) {
    return res.status(404).json({ error: 'Log not found or access denied' });
  }

  await logRef.update({
    ...filteredUpdates,
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200).json({ message: 'Recipe log updated' });
}

async function handleDelete(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const auth = await requireAuthForUsername(req, res, req.body.username);
  if (!auth) return;

  const logId = validatePostId(req.body.logId);
  if (!logId) {
    return res.status(400).json({ error: 'Valid logId is required' });
  }

  const logRef = db.collection('logs').doc(logId);
  const doc = await logRef.get();

  if (!doc.exists || doc.data().username !== auth.username) {
    return res.status(404).json({ error: 'Log not found or access denied' });
  }

  await logRef.delete();

  try {
    await deletePostSocialTree(db, logId);
  } catch (socialErr) {
    console.error('Failed to delete post social tree after log delete:', socialErr.message);
  }

  try {
    const userRef = db.collection('users').doc(auth.username);
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

  try {
    await db
      .collection('users')
      .doc(auth.username)
      .set({ cookingStats: { total_recipes: FieldValue.increment(-1) } }, { merge: true });
  } catch (counterErr) {
    console.error('Failed to decrement user recipe counter:', counterErr.message);
  }

  try {
    await refreshUserPersonality(db, auth.username);
  } catch (personalityErr) {
    console.error('Failed to refresh kitchen personality:', personalityErr.message);
  }

  res.status(200).json({ message: 'Recipe log deleted' });
}

const handlers = {
  create: handleCreate,
  update: handleUpdate,
  delete: handleDelete,
};

module.exports = async (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const action = `${req.query.action || ''}`.toLowerCase();
  const handler = handlers[action];

  if (!handler) {
    res.status(400).json({ error: 'Invalid or missing action', validActions: Object.keys(handlers) });
    return;
  }

  try {
    await handler(req, res);
  } catch (error) {
    console.error(`Error handling recipeLog action "${action}":`, error);
    res.status(500).json({
      error: `Failed to handle action "${action}"`,
      ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
    });
  }
};
