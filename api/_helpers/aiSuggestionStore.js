/**
 * Firestore persistence for AI-generated recipe suggestions.
 *
 * Schema:
 *   ai_suggestions/{username}/recipes/{recipeId}
 *     -> { section, recipe_name, name, ingredients, cooking_time, difficulty_level,
 *          description, why_suggested, image, hidden, generationId, createdAt, ... }
 *   ai_usage/{username}/daily/{YYYY-MM-DD}  (UTC)
 *     -> { count, updatedAt }
 */
const { FieldValue } = require('firebase-admin/firestore');

const DAILY_GENERATION_LIMIT = 3;
const VALID_SECTIONS = new Set(['friend', 'preference', 'pantry']);

function recipesRef(db, username) {
  return db.collection('ai_suggestions').doc(username).collection('recipes');
}

function usageRef(db, username, dateKey) {
  return db.collection('ai_usage').doc(username).collection('daily').doc(dateKey);
}

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function serializeRecipeDoc(doc) {
  const data = doc.data() || {};
  const name = data.name || data.recipe_name || 'Recipe';
  return {
    id: doc.id,
    section: data.section || 'preference',
    name,
    recipe_name: name,
    ingredients: data.ingredients || '',
    cooking_time: data.cooking_time || '',
    difficulty_level: data.difficulty_level || 'medium',
    description: data.description || '',
    steps: data.steps || '',
    why_suggested: data.why_suggested || data.reason || '',
    image: data.image || null,
    hidden: Boolean(data.hidden),
    generationId: data.generationId || null,
    ingredients_have: Array.isArray(data.ingredients_have) ? data.ingredients_have : [],
    ingredients_need: Array.isArray(data.ingredients_need) ? data.ingredients_need : [],
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
  };
}

function splitBySection(recipes) {
  const visible = (recipes || []).filter((r) => !r.hidden);
  return {
    friend_suggestions: visible.filter((r) => r.section === 'friend'),
    preference_suggestions: visible.filter((r) => r.section === 'preference'),
    pantry_suggestions: visible.filter((r) => r.section === 'pantry'),
  };
}

async function loadCachedSuggestions(db, username) {
  const snapshot = await recipesRef(db, username)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const recipes = snapshot.docs.map(serializeRecipeDoc);
  const usage = await getDailyUsage(db, username);

  return {
    ...splitBySection(recipes),
    total_cached: recipes.filter((r) => !r.hidden).length,
    generations_remaining: Math.max(0, DAILY_GENERATION_LIMIT - usage.count),
    generations_used_today: usage.count,
    daily_limit: DAILY_GENERATION_LIMIT,
  };
}

async function getDailyUsage(db, username, dateKey = utcDateKey()) {
  const doc = await usageRef(db, username, dateKey).get();
  if (!doc.exists) {
    return { count: 0, dateKey };
  }
  const data = doc.data() || {};
  return { count: Number(data.count) || 0, dateKey };
}

async function checkAndIncrementDailyUsage(db, username) {
  const dateKey = utcDateKey();
  const ref = usageRef(db, username, dateKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data().count) || 0 : 0;
    if (current >= DAILY_GENERATION_LIMIT) {
      return { allowed: false, count: current, dateKey };
    }
    tx.set(
      ref,
      {
        count: current + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { allowed: true, count: current + 1, dateKey };
  });
}

// Release a previously reserved generation slot when generation fails.
// Race-safe: the decrement runs in a transaction and is floored at 0 so the
// counter can never go negative; it only ever lowers the count, so it can
// never push the counter above DAILY_GENERATION_LIMIT either. Operates on the
// SAME dateKey the slot was reserved under (passed in by the caller) so a
// reservation made just before UTC midnight is refunded against the right day.
async function refundDailyUsage(db, username, dateKey = utcDateKey()) {
  const ref = usageRef(db, username, dateKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { count: 0, dateKey };
    }
    const current = Number(snap.data().count) || 0;
    const next = Math.max(0, current - 1);
    if (next === current) {
      return { count: current, dateKey };
    }
    tx.set(
      ref,
      {
        count: next,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { count: next, dateKey };
  });
}

async function cacheGeneratedRecipes(db, username, recipes, generationId) {
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const saved = [];

  for (const recipe of recipes) {
    const section = VALID_SECTIONS.has(recipe.section) ? recipe.section : 'preference';
    const name = (recipe.name || recipe.recipe_name || 'Recipe').trim();
    const docRef = recipesRef(db, username).doc();
    const payload = {
      section,
      name,
      recipe_name: name,
      ingredients: recipe.ingredients || '',
      cooking_time: recipe.cooking_time || '',
      difficulty_level: recipe.difficulty_level || 'medium',
      description: recipe.description || '',
      steps: recipe.steps || '',
      why_suggested: recipe.why_suggested || recipe.reason || '',
      image: recipe.image || null,
      ingredients_have: recipe.ingredients_have || [],
      ingredients_need: recipe.ingredients_need || [],
      hidden: false,
      generationId: generationId || null,
      createdAt: now,
    };
    batch.set(docRef, payload);
    saved.push({ id: docRef.id, ...payload });
  }

  await batch.commit();
  return saved;
}

async function hideRecipe(db, username, recipeId) {
  const docRef = recipesRef(db, username).doc(recipeId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { found: false };
  }
  await docRef.set({ hidden: true, hiddenAt: FieldValue.serverTimestamp() }, { merge: true });
  return { found: true };
}

async function saveCheckedIngredient(db, username, dateRangeKey, ingredientName, isChecked) {
  const ref = db.collection('ai_usage').doc(username)
    .collection('shopping_states').doc(dateRangeKey);
    
  await ref.set({
    [ingredientName]: isChecked
  }, { merge: true });
}

async function loadCheckedIngredients(db, username, dateRangeKey) {
  const doc = await db.collection('ai_usage').doc(username)
    .collection('shopping_states').doc(dateRangeKey).get();
    
  return doc.exists ? doc.data() : {};
}

module.exports = {
  DAILY_GENERATION_LIMIT,
  utcDateKey,
  loadCachedSuggestions,
  getDailyUsage,
  checkAndIncrementDailyUsage,
  refundDailyUsage,
  cacheGeneratedRecipes,
  hideRecipe,
  splitBySection,
  saveCheckedIngredient, 
  loadCheckedIngredients,
};
