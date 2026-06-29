/**
 * Meal-plan API (Cook Next calendar scheduling).
 *
 * Firestore data model:
 *   meal_plans/{username}/entries/{entryId}
 *     -> { date: 'YYYY-MM-DD', recipeId, recipeName, image?, ingredients?,
 *          difficulty_level?, cooking_time?, createdAt, updatedAt? }
 *
 * Actions (case-insensitive via ?action=):
 *   - getMealPlan       GET   ?action=getMealPlan&username=<u>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *                         resp { entries: [...] }
 *   - scheduleRecipe    POST  ?action=scheduleRecipe
 *                         body { username, date, recipeId, recipeName, ingredients?, image?,
 *                                difficulty_level?, cooking_time? }
 *                         resp { entry: {...} }
 *   - moveMealPlanEntry POST  ?action=moveMealPlanEntry
 *                         body { username, entryId, newDate }
 *                         resp { entry: {...} }
 *   - removeMealPlanEntry POST ?action=removeMealPlanEntry
 *                         body { username, entryId }
 *                         resp { message }
 *   - shoppingList      GET   ?action=shoppingList&username=<u>&startDate=...&endDate=...
 *                         resp { ingredients: [{ ingredient, recipes: [...] }], entryCount }
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const {
  normalizeUsername,
  validatePostId,
  validateDateString,
  validateDateRange,
  sanitizeText,
} = require('./_helpers/validateInput');
const { aggregateIngredients } = require('./_helpers/ingredientAggregation');

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

function entriesRef(username) {
  return db.collection('meal_plans').doc(username).collection('entries');
}

function serializeEntry(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    date: data.date,
    recipeId: data.recipeId,
    recipeName: data.recipeName,
    image: data.image || null,
    ingredients: data.ingredients || '',
    difficulty_level: data.difficulty_level || null,
    cooking_time: data.cooking_time || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  };
}

async function fetchEntriesInRange(username, startDate, endDate) {
  const snapshot = await entriesRef(username)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date', 'asc')
    .get();
  return snapshot.docs.map(serializeEntry);
}

async function handleGetMealPlan(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const range = validateDateRange(req.query.startDate, req.query.endDate);
  if (!range) {
    return res.status(400).json({ error: 'Valid startDate and endDate (YYYY-MM-DD) are required' });
  }

  const entries = await fetchEntriesInRange(username, range.startDate, range.endDate);
  res.status(200).json({ entries });
}

async function handleScheduleRecipe(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, date, recipeId, recipeName } = req.body || {};
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validDate = validateDateString(date);
  if (!validDate) {
    return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
  }

  const validRecipeId = validatePostId(recipeId) || sanitizeText(recipeId, 128);
  if (!validRecipeId) {
    return res.status(400).json({ error: 'Valid recipeId is required' });
  }

  const name = sanitizeText(recipeName, 200);
  if (!name) {
    return res.status(400).json({ error: 'recipeName is required' });
  }

  const entryData = {
    date: validDate,
    recipeId: validRecipeId,
    recipeName: name,
    ingredients: sanitizeText(req.body.ingredients, 10000),
    image: req.body.image ? sanitizeText(req.body.image, 2048) : null,
    difficulty_level: req.body.difficulty_level
      ? sanitizeText(req.body.difficulty_level, 50)
      : null,
    cooking_time: req.body.cooking_time ? sanitizeText(req.body.cooking_time, 50) : null,
    createdAt: FieldValue.serverTimestamp(),
  };

  const docRef = await entriesRef(auth.username).add(entryData);
  const created = await docRef.get();
  res.status(201).json({ entry: serializeEntry(created) });
}

async function handleMoveMealPlanEntry(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, entryId, newDate } = req.body || {};
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validEntryId = validatePostId(entryId);
  if (!validEntryId) {
    return res.status(400).json({ error: 'Valid entryId is required' });
  }

  const validDate = validateDateString(newDate);
  if (!validDate) {
    return res.status(400).json({ error: 'Valid newDate (YYYY-MM-DD) is required' });
  }

  const docRef = entriesRef(auth.username).doc(validEntryId);
  const existing = await docRef.get();
  if (!existing.exists) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  await docRef.update({
    date: validDate,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updated = await docRef.get();
  res.status(200).json({ entry: serializeEntry(updated) });
}

async function handleRemoveMealPlanEntry(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { username, entryId } = req.body || {};
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const validEntryId = validatePostId(entryId);
  if (!validEntryId) {
    return res.status(400).json({ error: 'Valid entryId is required' });
  }

  const docRef = entriesRef(auth.username).doc(validEntryId);
  const existing = await docRef.get();
  if (!existing.exists) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  await docRef.delete();
  res.status(200).json({ message: 'Entry removed' });
}

async function handleShoppingList(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const range = validateDateRange(req.query.startDate, req.query.endDate);
  if (!range) {
    return res.status(400).json({ error: 'Valid startDate and endDate (YYYY-MM-DD) are required' });
  }

  const entries = await fetchEntriesInRange(username, range.startDate, range.endDate);
  const ingredients = aggregateIngredients(entries);
  res.status(200).json({ ingredients, entryCount: entries.length });
}

const handlers = {
  getmealplan: handleGetMealPlan,
  schedulerecipe: handleScheduleRecipe,
  movemealplanentry: handleMoveMealPlanEntry,
  removemealplanentry: handleRemoveMealPlanEntry,
  shoppinglist: handleShoppingList,
};

module.exports = async (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const action = (req.query.action || '').toLowerCase();
  const handler = handlers[action];

  if (!handler) {
    res.status(400).json({
      error: 'Invalid or missing action',
      validActions: Object.keys(handlers),
    });
    return;
  }

  try {
    await handler(req, res);
  } catch (error) {
    console.error(`Error handling mealPlan action "${action}":`, error);
    res.status(500).json({ error: `Failed to handle action "${action}"`, details: error.message });
  }
};
