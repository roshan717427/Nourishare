/**
 * Lightweight kitchen personality analysis (ported from analyzePersonality.py).
 * Shared by createRecipeLog, deleteRecipeLog, and getUserProfile so personality
 * stays in sync without a separate analyze endpoint call.
 */

const CUISINE_CATEGORIES = {
  italian: ['pasta', 'pizza', 'risotto', 'bruschetta', 'tiramisu'],
  asian: ['sushi', 'stir-fry', 'curry', 'dumplings', 'ramen'],
  mexican: ['tacos', 'enchiladas', 'guacamole', 'quesadilla', 'churros'],
  thai: ['pad thai', 'tom yum', 'green curry', 'mango sticky rice'],
  indian: ['curry', 'naan', 'biryani', 'samosa', 'dal'],
  french: ['croissant', 'quiche', 'ratatouille', 'coq au vin', 'creme brulee'],
  mediterranean: ['hummus', 'falafel', 'paella', 'tzatziki', 'baklava'],
  american: ['burger', 'bbq', 'apple pie', 'mac and cheese', 'chicken wings'],
};

const DIFFICULTY_WEIGHTS = { easy: 1, medium: 2, hard: 3 };

function detectCuisinesFromTitle(title) {
  const detected = [];
  const titleLower = (title || '').toLowerCase();
  for (const [cuisine, keywords] of Object.entries(CUISINE_CATEGORIES)) {
    if (keywords.some((kw) => titleLower.includes(kw))) {
      detected.push(cuisine);
    }
  }
  return detected;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapLogToRecipe(logData) {
  return {
    title: logData.title || '',
    cuisines: detectCuisinesFromTitle(logData.title || ''),
    ingredients: Array.isArray(logData.ingredients)
      ? logData.ingredients
      : typeof logData.ingredients === 'string'
        ? logData.ingredients.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    rating: logData.rating || 0,
    difficulty: logData.difficulty || 'medium',
    cooking_time: logData.time || 30,
    created_at: logData.createdAt,
    source: logData.source || '',
    notes: logData.notes || '',
  };
}

function getDefaultPersonality() {
  return {
    primary_trait: 'Kitchen Newcomer',
    secondary_traits: ['Eager Learner', 'Open-Minded Palate'],
    top_cuisines: [],
    favorite_ingredients: [],
    cooking_frequency: 'new_cook',
    experimental_score: 0,
    comfort_score: 0,
    cuisine_diversity: 0,
    skill_level: 'newcomer',
    cooking_stats: {
      total_recipes: 0,
      avg_rating: 0,
      avg_difficulty: 2,
      avg_cooking_time: 30,
      unique_cuisines: 0,
      unique_ingredients: 0,
    },
    last_updated: new Date().toISOString(),
  };
}

function analyzeRecipes(recipes) {
  if (!recipes.length) return getDefaultPersonality();

  const cuisineCounts = {};
  const allCuisines = [];
  const difficulties = [];
  const ratings = [];
  const ingredientCounts = {};
  const cookingTimes = [];

  for (const recipe of recipes) {
    const cuisines = recipe.cuisines || [];
    allCuisines.push(...cuisines);
    for (const cuisine of cuisines) {
      cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
    }

    const difficulty = (recipe.difficulty || 'medium').toLowerCase();
    if (DIFFICULTY_WEIGHTS[difficulty]) {
      difficulties.push(DIFFICULTY_WEIGHTS[difficulty]);
    }

    const rating = Number(recipe.rating) || 0;
    if (rating > 0) ratings.push(rating);

    for (const ing of recipe.ingredients || []) {
      if (ing) ingredientCounts[ing] = (ingredientCounts[ing] || 0) + 1;
    }

    if (recipe.cooking_time) cookingTimes.push(Number(recipe.cooking_time) || 30);
  }

  const uniqueCuisines = new Set(allCuisines).size;
  const diversityScore = Math.min(1, uniqueCuisines / Math.max(recipes.length, 1));

  const avgDifficulty = difficulties.length
    ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
    : 2;
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 3;

  let stylePreference = 'balanced';
  if (avgDifficulty > 2.5) stylePreference = 'adventurous';
  else if (avgDifficulty < 1.5) stylePreference = 'comfort-focused';

  const topCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cuisine]) => cuisine);

  const topIngredients = Object.entries(ingredientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ingredient]) => ingredient);

  const avgCookingTime = cookingTimes.length
    ? cookingTimes.reduce((a, b) => a + b, 0) / cookingTimes.length
    : 30;

  let frequency = 'new_cook';
  if (recipes.length >= 10) frequency = 'experienced_cook';
  else if (recipes.length >= 5) frequency = 'regular_cook';
  else if (recipes.length >= 2) frequency = 'occasional_cook';

  let primaryTrait = 'Kitchen Enthusiast';
  if (diversityScore > 0.7) primaryTrait = 'Global Explorer';
  else if (stylePreference === 'adventurous') primaryTrait = 'Adventurous Chef';
  else if (avgRating > 4.5) primaryTrait = 'Quality Focused';
  else if (recipes.length > 20) primaryTrait = 'Experienced Cook';

  const secondaryTraits = [];
  if (diversityScore > 0.5) secondaryTraits.push('Varied Cuisines');
  if (stylePreference === 'balanced') secondaryTraits.push('Comfort & Adventure');
  if (topIngredients.length > 5) secondaryTraits.push('Ingredient Discovery');

  const experimentalScore = Math.min(
    1,
    Math.max(0, diversityScore * 0.6 + ((avgDifficulty - 1) / 2) * 0.4)
  );
  const experienceFactor =
    recipes.length >= 10 ? 0.8 : recipes.length >= 5 ? 0.6 : recipes.length >= 2 ? 0.4 : 0.2;
  const comfortScore = Math.min(
    1,
    Math.max(0, experienceFactor * 0.7 + (1 - diversityScore) * 0.3)
  );

  let skillLevel = 'newcomer';
  if (recipes.length >= 20) skillLevel = 'advanced';
  else if (recipes.length >= 10) skillLevel = 'intermediate';
  else if (recipes.length >= 3) skillLevel = 'beginner';

  return {
    primary_trait: primaryTrait,
    secondary_traits: secondaryTraits.slice(0, 2),
    // Cuisines and ingredients are user-curated via Edit Profile only.
    top_cuisines: [],
    favorite_ingredients: [],
    cooking_frequency: frequency,
    experimental_score: Math.round(experimentalScore * 100) / 100,
    comfort_score: Math.round(comfortScore * 100) / 100,
    cuisine_diversity: Math.round(diversityScore * 100) / 100,
    skill_level: skillLevel,
    cooking_stats: {
      total_recipes: recipes.length,
      avg_rating: Math.round(avgRating * 100) / 100,
      avg_difficulty: Math.round(avgDifficulty * 100) / 100,
      avg_cooking_time: Math.round(avgCookingTime * 100) / 100,
      unique_cuisines: Object.keys(cuisineCounts).length,
      unique_ingredients: Object.keys(ingredientCounts).length,
    },
    last_updated: new Date().toISOString(),
  };
}

async function fetchUserRecipes(db, username) {
  const snapshot = await db.collection('logs').where('username', '==', username).get();
  return snapshot.docs.map((doc) => mapLogToRecipe(doc.data()));
}

function mergeWithUserEdits(analyzed, existingPersonality, userData = {}) {
  const editedByUser = userData.personality_edited_by_user;
  if (!editedByUser || !existingPersonality) return analyzed;

  const merged = { ...analyzed };
  const preserveFields = ['primary_trait', 'secondary_traits'];
  for (const field of preserveFields) {
    const existing = existingPersonality[field];
    if (existing !== undefined && existing !== null) {
      if (Array.isArray(existing) ? existing.length > 0 : String(existing).trim()) {
        merged[field] = existing;
      }
    }
  }

  // Cuisines and ingredients are only preserved when explicitly set via Edit Profile.
  if (userData.top_cuisines_user_set) {
    merged.top_cuisines = (existingPersonality.top_cuisines || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  if (userData.favorite_ingredients_user_set) {
    merged.favorite_ingredients = existingPersonality.favorite_ingredients || [];
  }

  return merged;
}

async function refreshUserPersonality(db, username) {
  const userRef = db.collection('users').doc(username);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data() || {};
  const recipes = await fetchUserRecipes(db, username);
  const analyzed = analyzeRecipes(recipes);
  const merged = mergeWithUserEdits(analyzed, userData.kitchen_personality, userData);

  await userRef.set({ kitchen_personality: merged }, { merge: true });
  return merged;
}

function isPersonalityStale(storedPersonality, logCount) {
  const storedCount = storedPersonality?.cooking_stats?.total_recipes;
  if (storedCount == null) return logCount > 0;
  return storedCount !== logCount;
}

module.exports = {
  analyzeRecipes,
  refreshUserPersonality,
  isPersonalityStale,
  getDefaultPersonality,
};
