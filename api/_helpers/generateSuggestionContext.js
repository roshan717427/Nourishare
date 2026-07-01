/**
 * Gathers user context from Firestore for Gemini recipe prompts.
 */
const { sanitizePantryIngredients } = require('./validateInput');

async function getUserLogs(db, username, limit = 30) {
  const logs = [];
  try {
    let query = db
      .collection('logs')
      .where('username', '==', username)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    let snapshot;
    try {
      snapshot = await query.get();
    } catch {
      snapshot = await db.collection('logs').where('username', '==', username).limit(limit).get();
    }
    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const title = (data.title || '').trim();
      if (!title) return;
      logs.push({
        title,
        ingredients: data.ingredients || '',
        rating: data.rating,
        difficulty: data.difficulty || data.difficulty_level,
        time: data.time || data.cooking_time,
      });
    });
  } catch (err) {
    console.error('getUserLogs error:', err.message);
  }
  return logs;
}

async function getFollowedUsers(db, username) {
  const followed = [];
  try {
    const snap = await db
      .collection('following')
      .doc(username)
      .collection('user_following')
      .get();
    snap.forEach((doc) => followed.push(doc.id));
  } catch (err) {
    console.error('getFollowedUsers error:', err.message);
  }
  return followed;
}

async function getFriendsRecentMeals(db, followedUsers, limit = 20) {
  if (!followedUsers.length) return [];
  const meals = [];
  const collections = ['logs', 'recipe_posts'];

  for (const collectionName of collections) {
    for (let i = 0; i < followedUsers.length; i += 10) {
      const batch = followedUsers.slice(i, i + 10);
      try {
        const snap = await db
          .collection(collectionName)
          .where('username', 'in', batch)
          .limit(limit)
          .get();
        snap.forEach((doc) => {
          const data = doc.data() || {};
          const title = (data.title || data.recipe_name || '').trim();
          if (!title) return;
          meals.push({
            title,
            username: data.username,
            ingredients: data.ingredients || '',
          });
        });
      } catch (err) {
        console.error(`getFriendsRecentMeals ${collectionName}:`, err.message);
      }
    }
  }

  return meals.slice(0, limit);
}

async function getUserPreferences(db, username) {
  const prefs = { top_cuisines: [], favorite_ingredients: [] };
  try {
    const doc = await db.collection('users').doc(username).get();
    if (!doc.exists) return prefs;
    const data = doc.data() || {};
    const personality = data.kitchen_personality || {};
    if (data.top_cuisines_user_set) {
      prefs.top_cuisines = personality.top_cuisines || [];
    }
    if (data.favorite_ingredients_user_set) {
      prefs.favorite_ingredients = personality.favorite_ingredients || [];
    }
  } catch (err) {
    console.error('getUserPreferences error:', err.message);
  }
  return prefs;
}

function buildGeminiPrompt({ logs, friendsMeals, preferences, pantryIngredients }) {
  const logSummary = logs.length
    ? logs
        .slice(0, 12)
        .map((l) => `- ${l.title}${l.ingredients ? ` (${l.ingredients})` : ''}`)
        .join('\n')
    : 'No meals logged yet.';

  const friendSummary = friendsMeals.length
    ? friendsMeals
        .slice(0, 12)
        .map((m) => `- ${m.title} by @${m.username}`)
        .join('\n')
    : 'No friends followed or no recent friend meals.';

  const prefSummary = [
    preferences.top_cuisines?.length
      ? `Favorite cuisines: ${preferences.top_cuisines.join(', ')}`
      : null,
    preferences.favorite_ingredients?.length
      ? `Favorite ingredients: ${preferences.favorite_ingredients.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const pantrySummary = pantryIngredients?.length
    ? pantryIngredients.join(', ')
    : 'No pantry ingredients provided.';

  return `You are a creative home-cooking assistant for the Munchable app. Generate exactly 6 unique recipe suggestions as JSON.

Split them into three sections (2 recipes each):
1. "friend" — inspired by what the user's friends have been cooking (similar style/ingredients, NOT exact copies)
2. "preference" — based on the user's own logged meals and taste preferences
3. "pantry" — recipes the user can make using their pantry ingredients (only if pantry is provided; otherwise creative weeknight ideas using common staples)

User's recent logged meals:
${logSummary}

Friends' recent meals:
${friendSummary}

${prefSummary || 'No explicit preferences set.'}

Pantry ingredients on hand:
${pantrySummary}

Rules:
- Do NOT repeat exact dish names the user has already logged.
- Each recipe needs: name, ingredients (comma-separated string), cooking_time (e.g. "25 min"), difficulty_level (easy|medium|hard), description (1 sentence), why_suggested (short reason without leading "it").
- Return ONLY valid JSON in this shape:
{
  "recipes": [
    {
      "section": "friend",
      "name": "Recipe Name",
      "ingredients": "ingredient1, ingredient2",
      "cooking_time": "30 min",
      "difficulty_level": "easy",
      "description": "Brief appetizing description.",
      "why_suggested": "similar to the Thai flavors your friend enjoys"
    }
  ]
}`;
}

async function gatherGenerationContext(db, username, pantryRaw) {
  const pantryIngredients = sanitizePantryIngredients(pantryRaw) || [];
  const [logs, followedUsers, preferences] = await Promise.all([
    getUserLogs(db, username),
    getFollowedUsers(db, username),
    getUserPreferences(db, username),
  ]);
  const friendsMeals = await getFriendsRecentMeals(db, followedUsers);

  return {
    logs,
    friendsMeals,
    preferences,
    pantryIngredients,
    has_logs: logs.length > 0,
    has_friends: followedUsers.length > 0,
    prompt: buildGeminiPrompt({ logs, friendsMeals, preferences, pantryIngredients }),
  };
}

function tokenizeIngredients(raw) {
  if (!raw) return [];
  const text = Array.isArray(raw) ? raw.join(', ') : `${raw}`;
  return text
    .split(/[\r\n,;•·]|\band\b/i)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function applyPantryFlags(recipe, pantryTokens) {
  if (!pantryTokens.length) return recipe;
  const recipeTokens = tokenizeIngredients(recipe.ingredients);
  const have = [];
  const need = [];
  for (const token of recipeTokens) {
    const matched = pantryTokens.some(
      (p) => p.includes(token) || token.includes(p)
    );
    if (matched) have.push(token);
    else need.push(token);
  }
  return {
    ...recipe,
    ingredients_have: have,
    ingredients_need: need,
  };
}

function normalizeGeminiRecipes(parsed, pantryIngredients) {
  const pantryTokens = (pantryIngredients || []).map((p) => p.toLowerCase());
  const recipes = Array.isArray(parsed?.recipes) ? parsed.recipes : [];
  return recipes
    .filter((r) => r && (r.name || r.recipe_name))
    .map((r) =>
      applyPantryFlags(
        {
          section: r.section || 'preference',
          name: (r.name || r.recipe_name).trim(),
          ingredients: r.ingredients || '',
          cooking_time: r.cooking_time || '',
          difficulty_level: (r.difficulty_level || 'medium').toLowerCase(),
          description: r.description || '',
          why_suggested: r.why_suggested || r.reason || '',
        },
        pantryTokens
      )
    )
    .slice(0, 6);
}

module.exports = {
  gatherGenerationContext,
  normalizeGeminiRecipes,
  applyPantryFlags,
};
