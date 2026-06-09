const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { refreshUserPersonality, isPersonalityStale } = require('./personalityHelper');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Count logs per calendar month Jan–Dec for the given year. */
function computeCookingFrequency(logsSnap, year = new Date().getFullYear()) {
  const counts = {};

  logsSnap.forEach((logDoc) => {
    const logData = logDoc.data() || {};
    const ms = toMillis(logData.createdAt || logData.created_at);
    if (!ms) return;
    const d = new Date(ms);
    if (d.getFullYear() !== year) return;
    const month = d.getMonth();
    counts[month] = (counts[month] || 0) + 1;
  });

  const result = [];
  for (let month = 0; month < 12; month++) {
    result.push({
      month: MONTH_LABELS[month],
      value: counts[month] || 0,
    });
  }
  return result;
}

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
  // db will be undefined, which will cause errors in the handler
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }
  
  const { username } = req.query;
  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  try {
    const doc = await db.collection('users').doc(username).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const data = doc.data() || {};

    // Compute live stats so the profile reflects real activity:
    //  - total_recipes / avg_rating from the `logs` collection (source of truth;
    //    self-heals any drift in the cookingStats counter maintained by
    //    createRecipeLog).
    //  - followers / following counts from the top-level follow collections used
    //    across the social API.
    const [logsSnap, followersSnap, followingSnap] = await Promise.all([
      db.collection('logs').where('username', '==', username).get(),
      db.collection('followers').doc(username).collection('user_followers').get(),
      db.collection('following').doc(username).collection('user_following').get(),
    ]);

    const totalRecipes = logsSnap.size;
    let avgRating = null;
    const ratings = [];
    logsSnap.forEach((logDoc) => {
      const r = logDoc.data().rating;
      const num = typeof r === 'number' ? r : parseFloat(r);
      if (!Number.isNaN(num) && num > 0) ratings.push(num);
    });
    if (ratings.length > 0) {
      avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    }

    const followersCount = followersSnap.size;
    const followingCount = followingSnap.size;

    // Re-analyze personality when log count drifted from stored stats.
    let personality = data.kitchen_personality || {};
    if (isPersonalityStale(personality, totalRecipes)) {
      try {
        const refreshed = await refreshUserPersonality(db, username);
        if (refreshed) personality = refreshed;
      } catch (refreshErr) {
        console.error('Failed to refresh stale personality:', refreshErr.message);
      }
    }

    // Merge computed stats over the stored profile. Only override the cooking
    // stats when the user has real logs; otherwise keep whatever the stored
    // profile had (e.g. seeded demo data) so existing profiles aren't zeroed out.
    const storedStats = personality.cooking_stats || {};
    const mergedCookingStats = { ...storedStats };
    if (totalRecipes > 0) {
      mergedCookingStats.total_recipes = totalRecipes;
      if (avgRating != null) mergedCookingStats.avg_rating = avgRating;
    }

    // Drop stale auto-filled cuisines/ingredients unless the user saved them via Edit Profile.
    const kitchenPersonality = { ...personality, cooking_stats: mergedCookingStats };
    if (!data.top_cuisines_user_set) {
      kitchenPersonality.top_cuisines = [];
    } else if (Array.isArray(kitchenPersonality.top_cuisines)) {
      kitchenPersonality.top_cuisines = kitchenPersonality.top_cuisines
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    if (!data.favorite_ingredients_user_set) {
      kitchenPersonality.favorite_ingredients = [];
    }

    const response = {
      ...data,
      kitchen_personality: kitchenPersonality,
      // Live counts (override stored values). ProfileScreen renders both.
      followers: followersCount,
      following: followingCount,
      // Always derive from logs so bars reflect real activity (zeros when no logs).
      cookingFrequencyYear: new Date().getFullYear(),
      cookingFrequency: computeCookingFrequency(logsSnap),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ 
      error: 'Failed to get user profile',
      details: error.message 
    });
  }
};
