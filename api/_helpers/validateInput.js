const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;
const PERSON_NAME_RE = /^[A-Za-z]+$/;
const PASSWORD_SPECIAL_RE = /[!@#$%^&*]/;
const POST_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const POST_COLLECTIONS = ['logs', 'recipe_posts'];

const MAX_COMMENT = 2000;
const MAX_TEXT = 10000;
const MAX_TITLE = 200;
const MAX_SEARCH = 50;
const MAX_PANTRY_ITEMS = 50;
const MAX_COOKED_WITH = 20;

function normalizeUsername(raw) {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim().toLowerCase();
  return USERNAME_RE.test(value) ? value : null;
}

function validatePostId(raw) {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim();
  return POST_ID_RE.test(value) ? value : null;
}

function sanitizeText(raw, maxLen = MAX_TEXT) {
  if (raw == null) return '';
  let value = String(raw)
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  value = value.trim();
  if (value.length > maxLen) value = value.slice(0, maxLen);
  return value;
}

function sanitizeCommentText(raw) {
  return sanitizeText(raw, MAX_COMMENT);
}

function sanitizeCookedWith(raw) {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const out = [];
  const seen = new Set();
  for (const entry of items.slice(0, MAX_COOKED_WITH)) {
    const username = normalizeUsername(String(entry || '').trim().replace(/^@/, ''));
    if (username && !seen.has(username)) {
      seen.add(username);
      out.push(username);
    }
  }
  return out;
}

function sanitizePantryIngredients(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const item of raw.slice(0, MAX_PANTRY_ITEMS)) {
    const cleaned = sanitizeText(item, 100);
    if (cleaned) out.push(cleaned);
  }
  return out.length ? out : null;
}

function validateEmail(raw) {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

function validatePersonName(raw) {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim();
  if (!value || value.length > 50 || !PERSON_NAME_RE.test(value)) return null;
  return value;
}

function validatePassword(raw) {
  if (raw == null || raw === '') return null;
  const value = String(raw);
  if (value.length < 8) return null;
  if (!/[A-Z]/.test(value)) return null;
  if (!/[a-z]/.test(value)) return null;
  if (!PASSWORD_SPECIAL_RE.test(value)) return null;
  return value;
}

function validateSearchQuery(raw) {
  if (!raw) return '';
  return sanitizeText(raw, MAX_SEARCH);
}

function validateRating(raw) {
  const num = typeof raw === 'number' ? raw : parseFloat(raw);
  if (Number.isNaN(num) || num < 1 || num > 5) return null;
  return Math.round(num * 10) / 10;
}

function validateUrl(raw) {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).trim();
  if (!value || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

// Accepts http(s) URLs and data:image/...;base64,... URIs (from mobile photo pickers).
const MAX_DATA_URI_LENGTH = 900000;

function normalizeHttpUrl(raw) {
  if (raw == null || raw === '') return undefined;
  let value = String(raw).trim();
  if (!value || value.length > 2048) return undefined;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    value = `https://${value}`;
  }
  return validateUrl(value);
}

function validatePhotoUrl(raw) {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;
  if (value.startsWith('data:image/')) {
    if (value.length > MAX_DATA_URI_LENGTH) return undefined;
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(value)) return undefined;
    return value;
  }
  return normalizeHttpUrl(value);
}

function sanitizeRecipeLogFields(body) {
  return {
    title: sanitizeText(body.title, MAX_TITLE),
    photoUrl: validatePhotoUrl(body.photoUrl ?? body.photo_url),
    ingredients: sanitizeText(body.ingredients, MAX_TEXT),
    recipeLink: normalizeHttpUrl(body.recipeLink ?? body.recipe_link),
    recipeInstructions: sanitizeText(
      body.recipeInstructions ?? body.recipe_instructions,
      MAX_TEXT
    ),
    notes: sanitizeText(body.notes, MAX_TEXT),
    rating: validateRating(body.rating),
    difficulty: sanitizeText(body.difficulty, 50),
    time: sanitizeText(body.time, 50),
    cookedWith: sanitizeCookedWith(body.cookedWith),
  };
}

const ALLOWED_LOG_UPDATE_KEYS = new Set([
  'title',
  'photoUrl',
  'ingredients',
  'recipeLink',
  'recipeInstructions',
  'notes',
  'rating',
  'difficulty',
  'time',
  'cookedWith',
]);

function sanitizeLogUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const sanitized = sanitizeRecipeLogFields(updates);
  const out = {};
  for (const key of ALLOWED_LOG_UPDATE_KEYS) {
    if (updates[key] === undefined) continue;
    if (key === 'cookedWith') {
      out.cookedWith = sanitized.cookedWith;
      continue;
    }
    if (key === 'rating') {
      if (sanitized.rating == null) return null;
      out.rating = sanitized.rating;
      continue;
    }
    if (key === 'photoUrl' || key === 'recipeLink') {
      if (updates[key] != null && updates[key] !== '' && sanitized[key] === undefined) {
        return null;
      }
      if (sanitized[key] !== undefined) out[key] = sanitized[key];
      continue;
    }
    const value = sanitized[key];
    if (value === '' && key !== 'notes') continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

const ALLOWED_PROFILE_UPDATE_KEYS = new Set([
  'name',
  'bio',
  'profilePhotoUrl',
  'kitchen_personality',
  'personality_edited_by_user',
  'top_cuisines_user_set',
  'favorite_ingredients_user_set',
  'portfolio_favorites',
]);

function pickProfileUpdates(rawUpdates) {
  const out = {};
  for (const key of ALLOWED_PROFILE_UPDATE_KEYS) {
    if (rawUpdates[key] !== undefined) out[key] = rawUpdates[key];
  }
  if (out.name !== undefined) out.name = sanitizeText(out.name, 100);
  if (out.bio !== undefined) out.bio = sanitizeText(out.bio, 500);
  if (out.profilePhotoUrl !== undefined) {
    const url = validatePhotoUrl(out.profilePhotoUrl);
    if (out.profilePhotoUrl && url === undefined) return null;
    if (url !== undefined) out.profilePhotoUrl = url;
    else delete out.profilePhotoUrl;
  }
  if (out.portfolio_favorites !== undefined) {
    if (!Array.isArray(out.portfolio_favorites)) return null;
    const ids = out.portfolio_favorites
      .map((id) => validatePostId(id))
      .filter(Boolean)
      .slice(0, 2);
    out.portfolio_favorites = ids;
  }
  return out;
}

function resolveCollection(value) {
  const collectionName = (value || 'logs').toString();
  return POST_COLLECTIONS.includes(collectionName) ? collectionName : null;
}

function validateLimit(raw, defaultLimit, maxLimit) {
  const num = parseInt(raw, 10);
  if (Number.isNaN(num) || num < 1) return defaultLimit;
  return Math.min(num, maxLimit);
}

module.exports = {
  POST_COLLECTIONS,
  normalizeUsername,
  validatePostId,
  sanitizeText,
  sanitizeCommentText,
  sanitizeCookedWith,
  sanitizePantryIngredients,
  validateEmail,
  validatePersonName,
  validatePassword,
  validateSearchQuery,
  validateRating,
  validateUrl,
  normalizeHttpUrl,
  validatePhotoUrl,
  sanitizeRecipeLogFields,
  sanitizeLogUpdates,
  pickProfileUpdates,
  resolveCollection,
  validateLimit,
};
