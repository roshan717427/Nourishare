/**
 * Server-side title → stock image mapping for AI suggestion cards.
 * Mirrors utils/suggestionImages.js (subset for API handlers).
 */
const SECTION_IMAGES = {
  friend: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&q=80',
  preference: 'https://imhttps://images.unsplash.com/photo-1741011089185-fd2be1a7f53b?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3Dages.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80',
  pantry: 'https://images.unsplash.com/photo-1631021967261-c57ee4dfa9bb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
};

function sectionSuggestionImage(section) {
  return SECTION_IMAGES[section] || SECTION_IMAGES.preference;
}

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80';

const FALLBACK_IMAGES = [
  DEFAULT_FALLBACK_IMAGE,
  'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80',
  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
  'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
  'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
];

const TITLE_IMAGE_KEYWORDS = [
  { keywords: ['pasta', 'noodle', 'spaghetti'], url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&q=80' },
  { keywords: ['curry', 'soup'], url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { keywords: ['mac and cheese', 'macaroni'], url: 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80' },
  { keywords: ['stir-fry', 'stir fry', 'fried rice'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80' },
  { keywords: ['salad', 'bowl'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80' },
  { keywords: ['taco', 'tacos'], url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80' },
  { keywords: ['chicken'], url: 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80' },
  { keywords: ['salmon', 'fish'], url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80' },
  { keywords: ['pizza'], url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80' },
  { keywords: ['shrimp'], url: 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80' },
];

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFallbackImage(recipeName) {
  const normalized = normalizeTitle(recipeName);
  if (!normalized) return DEFAULT_FALLBACK_IMAGE;

  for (const { keywords, url } of TITLE_IMAGE_KEYWORDS) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) return url;
    }
  }

  const hash = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length];
}

module.exports = {
  DEFAULT_FALLBACK_IMAGE,
  sectionSuggestionImage,
};
