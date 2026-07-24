/**
 * AI recipe suggestions API (Gemini Flash + Firestore cache).
 *
 * GEMINI_API_KEY: server-side only. Restrict in Google AI Studio (IP/referrer).
 *
 * Actions (?action=, case-insensitive):
 *   loadCached   GET   ?action=loadCached&username=<u>
 *                  resp { status, friend_suggestions, preference_suggestions,
 *                         pantry_suggestions, generations_remaining, ... }
 *   generate     POST  ?action=generate
 *                  body { username, pantry_ingredients?: string[] }
 *                  resp { status, ...cached sections, generated_count }
 *   hide         POST  ?action=hide
 *                  body { username, recipeId }
 *                  resp { status, message }
 *
 * Daily generation limit: 3 generations per user per UTC day (= up to 18 recipes;
 * each generation aims for 6 recipes). Server-enforced.
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { normalizeUsername, sanitizePantryIngredients } = require('./_helpers/validateInput');
const {
  loadCachedSuggestions,
  checkAndIncrementDailyUsage,
  refundDailyUsage,
  cacheGeneratedRecipes,
  hideRecipe,
  DAILY_GENERATION_LIMIT,
  RECIPES_PER_GENERATION,
  saveCheckedIngredient,  
  loadCheckedIngredients,
} = require('./_helpers/aiSuggestionStore');
const { generateRecipesWithGemini } = require('./_helpers/geminiClient');
const {
  gatherGenerationContext,
  normalizeGeminiRecipes,
} = require('./_helpers/generateSuggestionContext');
const { sectionSuggestionImage } = require('./_helpers/suggestionImagesServer');
const { filterAiSuggestionPayload } = require('./_helpers/contentSafety');

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
  res.status(405).json({ error: 'Method Not Allowed' });
}

function dbUnavailable(res) {
  res.status(503).json({
    status: 'error',
    error: 'database_unavailable',
    message: 'Service temporarily unavailable',
  });
}

function normalizeAction(req) {
  const raw = req.query?.action || req.body?.action || '';
  return `${raw}`.trim().toLowerCase();
}

function attachImages(recipes) {
  return (recipes || []).map((recipe) => ({
    ...recipe,
    image: sectionSuggestionImage(recipe.section),
    subtitle: [recipe.difficulty_level, recipe.cooking_time].filter(Boolean).join(', '),
  }));
}

async function fetchRuleBasedFallback(username, pantryIngredients) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.API_BASE_URL || 'http://localhost:3000';

  // getSuggestions is an internal endpoint gated by a shared secret. Send the
  // secret server-to-server. INTERNAL_API_SECRET must be set in Vercel for both
  // this caller and the Python endpoint, or the call fails closed (rejected).
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_API_SECRET) {
    headers['x-internal-secret'] = process.env.INTERNAL_API_SECRET;
  }

  const response = await fetch(`${baseUrl}/api/getSuggestions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username,
      limit: 6,
      pantry_ingredients: pantryIngredients,
    }),
  });

  if (!response.ok) {
    throw new Error(`Rule-based fallback failed (${response.status})`);
  }

  const data = await response.json();
  const friend = (data.friend_suggestions || []).slice(0, 3).map((r) => ({
    section: 'friend',
    name: r.recipe_name || r.name,
    ingredients: r.ingredients || '',
    cooking_time: r.cooking_time || '',
    difficulty_level: r.difficulty_level || 'medium',
    description: r.cooking_notes || '',
    why_suggested: r.why_suggested || '',
    ingredients_have: r.ingredients_have || [],
    ingredients_need: r.ingredients_need || [],
  }));

  const preference = (data.preference_suggestions || []).slice(0, 3).map((r) => ({
    section: 'preference',
    name: r.recipe_name || r.name,
    ingredients: r.ingredients || '',
    cooking_time: r.cooking_time || '',
    difficulty_level: r.difficulty_level || 'medium',
    description: r.cooking_notes || '',
    why_suggested: r.why_suggested || '',
    ingredients_have: r.ingredients_have || [],
    ingredients_need: r.ingredients_need || [],
  }));

  const pantrySource = [...(data.preference_suggestions || []), ...(data.friend_suggestions || [])]
    .filter((r) => Array.isArray(r.ingredients_have) && r.ingredients_have.length > 0)
    .slice(0, 2)
    .map((r) => ({
      section: 'pantry',
      name: r.recipe_name || r.name,
      ingredients: r.ingredients || '',
      cooking_time: r.cooking_time || '',
      difficulty_level: r.difficulty_level || 'medium',
      description: r.cooking_notes || '',
      why_suggested: r.why_suggested || 'it uses ingredients you already have',
      ingredients_have: r.ingredients_have || [],
      ingredients_need: r.ingredients_need || [],
    }));

  // Prefer 6 recipes: with pantry use 2+2+2; without pantry use up to 3+3.
  if (pantryIngredients && pantryIngredients.length > 0) {
    return [...friend.slice(0, 2), ...preference.slice(0, 2), ...pantrySource.slice(0, 2)];
  }
  return [...friend.slice(0, 3), ...preference.slice(0, 3)];
}

function recipeNameKey(recipe) {
  return String(recipe?.name || recipe?.recipe_name || '')
    .trim()
    .toLowerCase();
}

async function topUpToSix(normalized, username, pantryIngredients) {
  if ((normalized || []).length >= RECIPES_PER_GENERATION) {
    return (normalized || []).slice(0, RECIPES_PER_GENERATION);
  }
  try {
    const fallback = await fetchRuleBasedFallback(username, pantryIngredients);
    const merged = [...(normalized || [])];
    const seen = new Set(merged.map(recipeNameKey).filter(Boolean));
    for (const recipe of fallback) {
      if (merged.length >= RECIPES_PER_GENERATION) break;
      const key = recipeNameKey(recipe);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      merged.push(recipe);
    }
    return merged.slice(0, RECIPES_PER_GENERATION);
  } catch (err) {
    console.warn('top-up fallback failed:', err.message);
    return (normalized || []).slice(0, RECIPES_PER_GENERATION);
  }
}

async function generateSuggestions(username, pantryRaw) {
  const context = await gatherGenerationContext(db, username, pantryRaw);
  const generationId = `gen_${Date.now()}`;
  const apiKey = process.env.GEMINI_API_KEY;

  let normalized = []; // Initialize as an empty array explicitly
  let source = 'gemini';

  if (apiKey) {
    try {
      // 1. Force the function to explicitly await the raw Gemini object processing
      const parsed = await generateRecipesWithGemini(apiKey, context.prompt);
      
      console.log(">>> Gemini Execution Successfully Returned Data <<<");

      // 2. Safely parse the recipes array profile
      const rawArray = parsed && !Array.isArray(parsed) ? (parsed.recipes || parsed.suggestions || []) : (parsed || []);
      
      // 3. Map your section parameters
      normalized = normalizeGeminiRecipes(rawArray, 'preference');
      
      console.log(`>>> Successfully normalized ${normalized.length} recipes <<<`);

    } catch (err) {
      if (err.code === 'gemini_rate_limit_rpm' || err.code === 'gemini_rate_limit_rpd') {
        console.warn('Gemini rate limited, using fallback suggestions:', err.message);
      } else {
        console.error('Gemini generation failed, falling back:', err.message);
      }
      // Await your local system fallback array loop
      normalized = await fetchRuleBasedFallback(username, context.pantryIngredients);
      source = 'rule_based_fallback';
    }
  } else {
    normalized = await fetchRuleBasedFallback(username, context.pantryIngredients);
    source = 'rule_based_fallback';
  }

  normalized = (normalized || []).map(filterAiSuggestionPayload).filter(Boolean);

  // Aim for 6 recipes per generation: top up from rule-based fallback if Gemini
  // returned fewer, then cap so we never cache more than one generation's worth.
  if (source === 'gemini' && normalized.length < RECIPES_PER_GENERATION) {
    const before = normalized.length;
    normalized = await topUpToSix(normalized, username, context.pantryIngredients);
    normalized = (normalized || []).map(filterAiSuggestionPayload).filter(Boolean);
    if (normalized.length > before) {
      source = 'gemini_with_fallback_topup';
    }
  }

  normalized = (normalized || []).slice(0, RECIPES_PER_GENERATION);

  // 4. Critical guard: If data arrays drop to zero, throw an explicit error to release daily quotas
  if (!normalized || !normalized.length) {
    const error = new Error('No recipes could be generated');
    error.code = 'generation_empty';
    throw error;
  }

  const withImages = attachImages(normalized);
  
  // 5. Await your Firestore database operations so Vercel doesn't freeze prematurely!
  await cacheGeneratedRecipes(db, username, withImages, generationId);

  const cached = await loadCachedSuggestions(db, username);

  return {
    status: 'success',
    source,
    generated_count: withImages.length,
    has_logs: context.has_logs,
    has_friends: context.has_friends,
    generations_remaining: cached.generations_remaining ?? 3,
    generations_used_today: cached.generations_used_today ?? 0,
    daily_limit: cached.daily_limit ?? 3,
    
    // CamelCase options for standard context model states
    friendSuggestions: attachImages(cached.friend_suggestions),
    preferenceSuggestions: attachImages(cached.preference_suggestions),
    pantrySuggestions: attachImages(cached.pantry_suggestions),

    // Snake_case options for direct screen component maps
    friend_suggestions: attachImages(cached.friend_suggestions),
    preference_suggestions: attachImages(cached.preference_suggestions),
    pantry_suggestions: attachImages(cached.pantry_suggestions),
  };
}

async function handleLoadCached(req, res) {
  const username = normalizeUsername(req.query?.username || req.body?.username);
  if (!username) {
    res.status(400).json({ status: 'error', error: 'invalid_username' });
    return;
  }

  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const [cached, context] = await Promise.all([
    loadCachedSuggestions(db, username),
    gatherGenerationContext(db, username, null),
  ]);

  res.status(200).json({
    status: 'success',
    ...cached,
    has_logs: context.has_logs,
    has_friends: context.has_friends,
    friend_suggestions: attachImages(cached.friend_suggestions),
    preference_suggestions: attachImages(cached.preference_suggestions),
    pantry_suggestions: attachImages(cached.pantry_suggestions),
  });
}

async function handleGenerate(req, res) {
  const username = normalizeUsername(req.body?.username);
  if (!username) {
    res.status(400).json({ status: 'error', error: 'invalid_username' });
    return;
  }

  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  // Reserve a generation slot TRANSACTIONALLY before doing any expensive work.
  // This atomic check-and-increment (keyed on the authenticated username + the
  // server-side UTC date) is the single source of truth for the daily cap, so
  // concurrent requests can never each pass a stale pre-check and run Gemini
  // beyond the limit. The Gemini call only happens once a slot is held.
  const reservation = await checkAndIncrementDailyUsage(db, username);
  if (!reservation.allowed) {
    res.status(429).json({
      status: 'error',
      error: 'daily_limit_exceeded',
      code: 'daily_limit_exceeded',
      message: 'Daily generation limit reached',
      generations_used_today: reservation.count,
      daily_limit: DAILY_GENERATION_LIMIT,
      generations_remaining: 0,
    });
    return;
  }

  const pantryRaw = req.body?.pantry_ingredients;

  try {
    const result = await generateSuggestions(username, pantryRaw);
    
    console.log(">>> Sending unified recipe objects back to TestFlight app client <<<");

    // FIX: Send down a clean combination of the formatted result variables 
    // without clobbering the snake_case suggestions arrays!
    res.status(200).json({
      status: 'success',
      generated_count: result.generated_count || RECIPES_PER_GENERATION,
      has_logs: result.has_logs,
      has_friends: result.has_friends,
      generations_used_today: reservation.count,
      generations_remaining: Math.max(0, DAILY_GENERATION_LIMIT - reservation.count),
      daily_limit: DAILY_GENERATION_LIMIT,
      
      // Explicitly pass both cases down to keep the screen mapping hooks aligned
      friendSuggestions: result.friendSuggestions,
      preferenceSuggestions: result.preferenceSuggestions,
      pantrySuggestions: result.pantrySuggestions,

      friend_suggestions: result.friend_suggestions,
      preference_suggestions: result.preference_suggestions,
      pantry_suggestions: result.pantry_suggestions,
    });
  } catch (err) {
    // Generation failed after the slot was reserved — refund it so the user is
    // not charged a credit for a failed generation. The refund is race-safe
    // (transactional, floored at 0) and only releases this request's slot.
    try {
      await refundDailyUsage(db, username, reservation.dateKey);
    } catch (refundErr) {
      console.error('daily usage refund failed:', refundErr.message);
    }

    if (err.code === 'gemini_rate_limit_rpm') {
      res.status(429).json({
        status: 'error',
        error: 'gemini_rate_limit_rpm',
        code: 'gemini_rate_limit_rpm',
        message: err.message,
      });
      return;
    }
    if (err.code === 'gemini_rate_limit_rpd') {
      res.status(429).json({
        status: 'error',
        error: 'gemini_rate_limit_rpd',
        code: 'gemini_rate_limit_rpd',
        message: err.message,
      });
      return;
    }
    console.error('generate error:', err);
    res.status(500).json({
      status: 'error',
      error: 'generation_failed',
      code: 'generation_failed',
      message: 'Failed to generate suggestions',
    });
  }
}

async function handleHide(req, res) {
  const username = normalizeUsername(req.body?.username);
  const recipeId = `${req.body?.recipeId || req.body?.recipe_id || ''}`.trim();

  if (!username || !recipeId) {
    res.status(400).json({ status: 'error', error: 'invalid_request' });
    return;
  }

  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  const result = await hideRecipe(db, username, recipeId);
  if (!result.found) {
    res.status(404).json({ status: 'error', error: 'not_found' });
    return;
  }

  res.status(200).json({ status: 'success', message: 'Recipe hidden' });
}

async function handleShoppingState(req, res) {
  const action = normalizeAction(req); // 'save' or 'load'
  
  if (action === 'save') {
    const { username, rangeKey, ingredient, isChecked } = req.body || {};
    if (!username || !rangeKey || !ingredient) {
      return res.status(400).json({ status: 'error', error: 'missing_parameters' });
    }
    
    await saveCheckedIngredient(db, username, rangeKey, ingredient, isChecked);
    return res.status(200).json({ status: 'success' });
  } 
  
  if (action === 'load') {
    const username = req.query?.username || req.body?.username;
    const rangeKey = req.query?.rangeKey || req.body?.rangeKey;
    if (!username || !rangeKey) {
      return res.status(400).json({ status: 'error', error: 'missing_parameters' });
    }
    
    const states = await loadCheckedIngredients(db, username, rangeKey);
    return res.status(200).json({ status: 'success', states });
  }

  return methodNotAllowed(res);
}

module.exports = async (req, res) => {
  if (!db) {
    dbUnavailable(res);
    return;
  }

  const action = normalizeAction(req);
  const method = (req.method || 'GET').toUpperCase();

  if (action === 'save' || action === 'load') {
    return handleShoppingState(req, res);
  }


  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (action === 'loadcached' && method === 'GET') {
      await handleLoadCached(req, res);
      return;
    }
    if (action === 'generate' && method === 'POST') {
      await handleGenerate(req, res);
      return;
    }
    if (action === 'hide' && method === 'POST') {
      await handleHide(req, res);
      return;
    }

    if (!action) {
      res.status(400).json({
        status: 'error',
        error: 'missing_action',
        message: 'Provide ?action=loadCached|generate|hide',
      });
      return;
    }

    methodNotAllowed(res);
  } catch (err) {
    console.error('aiSuggestions handler error:', err);
    res.status(500).json({
      status: 'error',
      error: 'internal_error',
      message: 'Something went wrong',
    });
  }
};
