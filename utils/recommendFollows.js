/**
 * Score and rank follow recommendations by overlapping kitchen profile keywords.
 * Used by the social API and ExploreScreen client fallback.
 */

const STOP_WORDS = new Set(['and', 'the', 'a', 'an', 'or', 'of', 'in', 'on', 'with', 'for', 'to']);

function normalizeToken(value) {
  return (value || '').toLowerCase().trim();
}

function tokenizeString(str) {
  if (!str) return [];
  return str
    .split(/[\s,/|&]+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function addKeyword(map, raw, type) {
  const display = String(raw || '').trim();
  const key = normalizeToken(display);
  if (!key || map.has(key)) return;
  map.set(key, { type, display });
}

function extractKeywords(profile) {
  const keywords = new Map();
  const personality = profile?.kitchen_personality || {};

  if (personality.primary_trait) {
    addKeyword(keywords, personality.primary_trait, 'trait');
    tokenizeString(personality.primary_trait).forEach((token) =>
      addKeyword(keywords, token, 'trait')
    );
  }

  (personality.secondary_traits || []).forEach((trait) => {
    addKeyword(keywords, trait, 'trait');
    tokenizeString(trait).forEach((token) => addKeyword(keywords, token, 'trait'));
  });

  const cuisines = personality.top_cuisines || profile?.top_cuisines || profile?.topCuisines;
  (cuisines || []).forEach((item) => addKeyword(keywords, item, 'cuisine'));

  const ingredients =
    personality.favorite_ingredients ||
    profile?.favorite_ingredients ||
    profile?.favoriteIngredients;
  (ingredients || []).forEach((item) => addKeyword(keywords, item, 'ingredient'));

  return keywords;
}

function hasProfileData(profile) {
  return extractKeywords(profile).size > 0;
}

function scoreMatch(userProfile, candidateProfile) {
  const userKeywords = extractKeywords(userProfile);
  const candidateKeywords = extractKeywords(candidateProfile);
  const overlaps = { cuisine: [], ingredient: [], trait: [] };
  let score = 0;

  candidateKeywords.forEach((meta, key) => {
    if (!userKeywords.has(key)) return;
    score += meta.type === 'cuisine' || meta.type === 'ingredient' ? 2 : 1;
    overlaps[meta.type].push(meta.display);
  });

  return { score, overlaps };
}

/** Scoring metadata only; not shown in the Explore UI. */
function buildMatchReason() {
  return '';
}

function rankRecommendations(userProfile, candidates, options = {}) {
  const exclude = new Set((options.exclude || []).map((u) => normalizeToken(u)));
  const limit = options.limit ?? 6;

  return candidates
    .filter((candidate) => candidate?.username && !exclude.has(normalizeToken(candidate.username)))
    .map((candidate) => {
      const { score, overlaps } = scoreMatch(userProfile, candidate);
      return {
        username: candidate.username,
        name: candidate.name || candidate.username,
        profilePhotoUrl: candidate.profilePhotoUrl || null,
        matchScore: score,
        matchReason: buildMatchReason(overlaps),
      };
    })
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

module.exports = {
  extractKeywords,
  hasProfileData,
  rankRecommendations,
  buildMatchReason,
};
