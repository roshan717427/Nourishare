/**
 * Shared title → stock image mapping for AI suggestion cards.
 * Server (api/suggestion_images.py) mirrors this data and matching logic.
 */

export const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80';

export const FALLBACK_IMAGES = [
  DEFAULT_FALLBACK_IMAGE,
  'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80',
  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
  'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
  'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
];

// Verified Unsplash food photos — longest / most specific keywords first.
export const TITLE_IMAGE_KEYWORDS = [
  { keywords: ['tomato pasta', 'weeknight pasta', 'pasta bolognese', 'meat pasta'], url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&q=80' },
  { keywords: ['coconut curry soup', 'coconut curry', 'tom yum'], url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { keywords: ['mac and cheese', 'mac n cheese', 'macaroni'], url: 'https://images.unsplash.com/photo-1539136788836-5699e78bfc75?w=500&q=80' },
  { keywords: ['pad thai', 'lo mein', 'fried rice'], url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80' },
  { keywords: ['ginger soy', 'stir-fry', 'stir fry'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80' },
  { keywords: ['sesame noodle', 'sesame'], url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80' },
  { keywords: ['crispy roasted', 'roasted potato', 'roasted potatoes'], url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80' },
  { keywords: ['roasted veggie', 'veggie bowl', 'grain bowl'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80' },
  { keywords: ['greek salad', 'salad bowl'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80' },
  { keywords: ['chicken taco', 'chicken tacos', 'weeknight chicken'], url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80' },
  { keywords: ['quick herb chicken', 'herb chicken', 'chicken skillet', 'roast chicken'], url: 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80' },
  { keywords: ['thai basil', 'basil chicken'], url: 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80' },
  { keywords: ['black bean quesadilla', 'bean quesadilla'], url: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=500&q=80' },
  { keywords: ['sheet pan', 'bbq chicken'], url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80' },
  { keywords: ['lemon herb salmon', 'honey garlic salmon', 'glazed salmon'], url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80' },
  { keywords: ['beef and broccoli', 'beef broccoli'], url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80' },
  { keywords: ['garlic butter shrimp', 'butter shrimp'], url: 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80' },
  { keywords: ['crispy tofu', 'tofu stir'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80' },
  { keywords: ['chickpea curry', 'tandoori'], url: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80' },
  { keywords: ['potato', 'potatoes'], url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80' },
  { keywords: ['pasta', 'spaghetti', 'lasagna', 'ravioli', 'carbonara', 'penne', 'fettuccine', 'gnocchi'], url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80' },
  { keywords: ['noodle', 'ramen', 'pho', 'udon'], url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80' },
  { keywords: ['pizza', 'flatbread', 'margherita', 'calzone'], url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80' },
  { keywords: ['taco', 'quesadilla', 'burrito', 'enchilada', 'nacho', 'salsa', 'guacamole', 'tortilla'], url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80' },
  { keywords: ['curry', 'tikka', 'masala', 'biryani', 'korma', 'vindaloo'], url: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80' },
  { keywords: ['coconut'], url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { keywords: ['salmon', 'trout', 'cod', 'tilapia', 'fish'], url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80' },
  { keywords: ['chicken', 'wing', 'poultry', 'drumstick'], url: 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80' },
  { keywords: ['beef', 'steak', 'brisket', 'meatball'], url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80' },
  { keywords: ['pork', 'bacon', 'ham', 'sausage', 'prosciutto'], url: 'https://images.unsplash.com/photo-1432130438734-24cdc404168c?w=500&q=80' },
  { keywords: ['lamb', 'kebab', 'skewer'], url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80' },
  { keywords: ['shrimp', 'prawn', 'lobster', 'crab', 'seafood'], url: 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80' },
  { keywords: ['tofu', 'tempeh'], url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80' },
  { keywords: ['wok'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80' },
  { keywords: ['broccoli'], url: 'https://images.unsplash.com/photo-1459411552884-e45e3d4613d5?w=500&q=80' },
  { keywords: ['rice', 'risotto', 'pilaf'], url: 'https://images.unsplash.com/photo-1603133872877-684f208b89d7?w=500&q=80' },
  { keywords: ['soup', 'stew', 'chowder', 'bisque', 'broth'], url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { keywords: ['salad', 'slaw', 'greens'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80' },
  { keywords: ['burger', 'sandwich', 'wrap', 'slider'], url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
  { keywords: ['omelette', 'frittata', 'quiche'], url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80' },
  { keywords: ['egg'], url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80' },
  { keywords: ['pancake', 'waffle', 'french toast', 'breakfast'], url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=80' },
  { keywords: ['dumpling', 'gyoza', 'potsticker', 'bao'], url: 'https://images.unsplash.com/photo-1496116218413-95a0c151e16a?w=500&q=80' },
  { keywords: ['sushi', 'sashimi', 'poke'], url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=500&q=80' },
  { keywords: ['hummus', 'falafel', 'mezze'], url: 'https://images.unsplash.com/photo-1623428187425-4a3a3e5e5c0d?w=500&q=80' },
  { keywords: ['mushroom'], url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80' },
  { keywords: ['chickpea', 'dal', 'bean', 'lentil', 'chili'], url: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80' },
  { keywords: ['avocado'], url: 'https://images.unsplash.com/photo-1523049673857-eb18f1adf7ae?w=500&q=80' },
  { keywords: ['corn'], url: 'https://images.unsplash.com/photo-1551758254-08f81a683d77?w=500&q=80' },
  { keywords: ['cauliflower'], url: 'https://images.unsplash.com/photo-1568584711073-975fb5061c86?w=500&q=80' },
  { keywords: ['bbq', 'grill', 'roasted', 'roast'], url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80' },
  { keywords: ['thai', 'lemongrass'], url: 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80' },
  { keywords: ['basil'], url: 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80' },
  { keywords: ['bowl', 'veggie', 'vegetable', 'greek', 'grain'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80' },
  { keywords: ['cake', 'cookie', 'dessert', 'pie', 'brownie'], url: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=500&q=80' },
];

// Guaranteed pairings for curated template / ingredient ideas.
export const EXACT_TITLE_IMAGES = {
  'creamy garlic pasta': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80',
  'margherita flatbread': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
  'ginger soy stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80',
  'sesame noodle bowl': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
  'weeknight chicken tacos': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
  'black bean quesadilla': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=500&q=80',
  'thai basil chicken': 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80',
  'coconut curry soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80',
  'chickpea curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
  'tandoori spiced sheet pan dinner': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80',
  'greek salad bowl': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
  'lemon herb salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80',
  'sheet pan bbq chicken': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80',
  'classic mac and cheese': 'https://images.unsplash.com/photo-1539136788836-5699e78bfc75?w=500&q=80',
  'one pan roasted veggie bowl': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
  'quick herb chicken skillet': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80',
  'lemon herb roast chicken': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80',
  'weeknight tomato pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&q=80',
  'fried rice with vegetables': 'https://images.unsplash.com/photo-1603133872877-684f208b89d7?w=500&q=80',
  'crispy tofu stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80',
  'honey garlic glazed salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80',
  'savory beef and broccoli': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80',
  'garlic butter shrimp': 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80',
  'crispy roasted potatoes': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80',
};

const TITLE_STOP_WORDS = new Set([
  'with', 'and', 'the', 'a', 'an', 'your', 'fresh', 'twist', 'easy', 'quick',
  'next', 'level', 'inspired', 'logged', 'dish', 'chef', 'favorite', 'style',
  'one', 'pan', 'weeknight', 'classic', 'savory', 'herb', 'herbs', 'lemon',
  'garlic', 'honey', 'ginger', 'soy', 'spiced', 'glazed', 'crispy', 'roasted',
]);

const FOOD_TOKEN_HINTS = [
  'pasta', 'noodle', 'noodles', 'pizza', 'taco', 'tacos', 'curry', 'soup', 'stew',
  'salad', 'chicken', 'beef', 'pork', 'salmon', 'shrimp', 'tofu', 'rice', 'bowl',
  'burger', 'sandwich', 'sushi', 'ramen', 'pho', 'quesadilla', 'burrito',
  'dumpling', 'pancake', 'waffle', 'steak', 'fish', 'lobster', 'crab',
  'mushroom', 'broccoli', 'potato', 'potatoes', 'avocado', 'bean', 'beans',
  'lentil', 'chili', 'coconut', 'basil', 'thai', 'taco', 'macaroni',
];

export function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function keywordMatchesTitle(keyword, normalizedTitle) {
  if (!keyword || !normalizedTitle) return false;
  if (keyword.includes(' ')) {
    return normalizedTitle.includes(keyword);
  }
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`);
  return pattern.test(normalizedTitle);
}

function scoreKeywordMatches(normalizedTitle) {
  let bestUrl = null;
  let bestLength = 0;

  for (const { keywords, url } of TITLE_IMAGE_KEYWORDS) {
    for (const keyword of keywords) {
      if (keywordMatchesTitle(keyword, normalizedTitle) && keyword.length > bestLength) {
        bestLength = keyword.length;
        bestUrl = url;
      }
    }
  }

  return bestUrl;
}

function tokenFallbackImage(normalizedTitle) {
  const words = normalizedTitle.split(' ').filter(Boolean);
  for (const hint of FOOD_TOKEN_HINTS) {
    if (words.includes(hint)) {
      for (const { keywords, url } of TITLE_IMAGE_KEYWORDS) {
        if (keywords.includes(hint)) {
          return url;
        }
      }
    }
  }

  for (const word of words) {
    if (word.length < 4 || TITLE_STOP_WORDS.has(word)) continue;
    for (const { keywords, url } of TITLE_IMAGE_KEYWORDS) {
      if (keywords.some((keyword) => !keyword.includes(' ') && keyword === word)) {
        return url;
      }
    }
  }

  return null;
}

export function titleFallbackImage(recipeName) {
  const normalizedTitle = normalizeTitle(recipeName);
  if (!normalizedTitle) return DEFAULT_FALLBACK_IMAGE;

  if (EXACT_TITLE_IMAGES[normalizedTitle]) {
    return EXACT_TITLE_IMAGES[normalizedTitle];
  }

  const scored = scoreKeywordMatches(normalizedTitle);
  if (scored) return scored;

  const tokenMatch = tokenFallbackImage(normalizedTitle);
  if (tokenMatch) return tokenMatch;

  const hash = [...normalizedTitle].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length];
}

export function resolveSuggestionImage(suggestion, recipeName) {
  const name = recipeName || suggestion?.name || suggestion?.recipe_name || 'Recipe';
  const titled = titleFallbackImage(name);
  return typeof titled === 'string' && titled.trim().toLowerCase().startsWith('https://')
    ? titled
    : DEFAULT_FALLBACK_IMAGE;
}
