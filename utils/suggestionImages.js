/**
 * Shared title → stock image mapping for AI suggestion cards.
 * Server (api/_helpers/suggestion_images.py) mirrors this data and matching logic.
 */

export const DEFAULT_FALLBACK_IMAGE =
  'https://www.magnific.com/free-vector/blank-plate-with-spoon-fork_2591609.htm#fromView=search&page=1&position=10&uuid=f0abc3ce-cee1-40b0-b582-351f8ff2bcee&query=plate%2C+spoon%2C+fork';

export const FALLBACK_IMAGES = [
  DEFAULT_FALLBACK_IMAGE,
  'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80',
  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
  'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
  'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
  'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80'
];

// Verified Unsplash food photos — longest / most specific keywords first.
export const TITLE_IMAGE_KEYWORDS = [
  { keywords: ['tomato pasta', 'weeknight pasta', 'pasta bolognese', 'meat pasta'], url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&q=80' },
  { keywords: ['tomato basil soup', 'coconut soup', 'tomato bisque'], url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { keywords: ['mac and cheese', 'mac n cheese', 'macaroni', 'mac'], url: 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80' },
  { keywords: ['ebi ramen', 'seafood noodle bowl', 'prawn ramen', 'pho', 'udon'], url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80' },
  { keywords: ['shrimp fried rice', 'seafood paella', 'cajun dirty rice skillet'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80' },
  { keywords: ['crispy roasted', 'roasted potato', 'roasted potatoes'], url: 'https://unsplash.com/photos/a-white-plate-topped-with-potatoes-and-parsley-9DEggBoY8CY' },
  { keywords: ['greek salad', 'salad bowl', 'veggie bowl'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80' },
  { keywords: ['chicken taco', 'chicken tacos', 'tacos'], url: 'https://unsplash.com/photos/a-plate-of-food-t97ZUtiJ6hc' },
  { keywords: ['quick herb chicken', 'herb chicken', 'chicken skillet', 'roast chicken'], url: 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80' },
  { keywords: ['thai basil fried rice', 'basil fried rice', 'fried rice'], url: 'https://unsplash.com/photos/a-plate-of-rice-with-shrimp-and-vegetables-o6Oq7rBMqVc' },
  { keywords: ['black bean quesadilla', 'bean quesadilla'], url: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=500&q=80' },
  { keywords: ['bbq ribs', 'roasted bbq'], url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80' },
  { keywords: ['lemon herb salmon', 'honey garlic salmon', 'glazed salmon'], url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80' },
  { keywords: ['mixed vegetable curry', 'aloo gobhi matar'], url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80' },
  { keywords: ['garlic butter shrimp', 'butter shrimp'], url: 'https://unsplash.com/photos/a-pan-of-food-aEHCeaGSgKA' },
  { keywords: ['crispy tofu', 'tofu dip'], url: 'https://unsplash.com/photos/a-pile-of-fried-food-next-to-chopsticks-on-a-cutting-board-6pDHFyXc73U' },
  { keywords: ['thai red curry', 'kaeng phet'], url: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80' },
  { keywords: ['flat noodles', 'fettuccine', 'creamy steak fettuccine', 'beef tagliatelle'], url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80' },
  { keywords: ['margherita pizza', 'cheese pizza'], url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80' },
  { keywords: ['tacos', 'chalupas', 'tostadas'], url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80' },
  { keywords: ['chicken biryani', 'biryani'], url: 'https://unsplash.com/s/photos/briyani' },
  { keywords: ['luscious couscous', 'couscous'], url: 'https://unsplash.com/photos/cooked-food-in-white-ceramic-bowl-zPn53_jmW_k' },
  { keywords: ['juicy meatballs', 'meatballs'], url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80' },
  { keywords: ['korean bibimbap', 'bibimbap'], url: 'https://unsplash.com/photos/a-table-topped-with-bowls-of-food-and-chopsticks--UUkXJIXgy4' },
  { keywords: ['tofu/veggie bowl', 'tempeh/veggie bowl', 'tofu bowl', 'tempeh bowl'], url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80' },
  { keywords: ['jambalaya'], url: 'https://unsplash.com/photos/a-plate-of-food-that-is-on-a-table-LzZoIV9gc7Q' },
  { keywords: ['broccoli cauliflower soup'], url: 'https://unsplash.com/photos/bowl-of-vegetable-soup-x4l4U-pHF9s' },
  { keywords: ['uzbek pilaf', 'lamb pilaf', 'pilaf'], url: 'https://unsplash.com/photos/a-plate-of-rice-with-meat-and-vegetables-ojDzHZHcVx4' },
  { keywords: ['double patty burger', 'double patty slider'], url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
  { keywords: ['omelette', 'frittata', 'quiche'], url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80' },
  { keywords: ['egg avocado toast', 'avocado toast', 'egg toast'], url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80' },
  { keywords: ['pancake', 'breakfast pancakes', 'pancakes & syrup'], url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=80' },
  { keywords: ['pan-fried momos', 'steamed momos', 'potstickers', 'wontons'], url: 'https://unsplash.com/photos/dumpling-dishes-LR559Dcst70' },
  { keywords: ['sushi', 'sushi rolls', 'sushi platter'], url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=500&q=80' },
  { keywords: ['falafel wrap', 'crunchy falafel wrap', 'falafel wrap with tzatziki'], url: 'https://unsplash.com/photos/delicious-breakfast-plates-with-bagels-and-juice-D4Q1pFoDEV0' },
  { keywords: ['cheesy mushroom risotto', 'mushroom risotto', 'creamy mushroom risotto', 'risotto'], url: 'https://unsplash.com/photos/fried-rice-with-green-vegetable-on-brown-ceramic-plate-708OpfCW4H8' },
  { keywords: ['delicious dal', 'dal'], url: 'https://unsplash.com/photos/sliced-orange-fruit-beside-white-ceramic-bowl-with-green-soup-iEJ3GhgO3jY' },
  { keywords: ['tasty avocado dip', 'avocado dip'], url: 'https://unsplash.com/photos/green-vegetable-on-gray-ceramic-bowl-JqDn6CvyVhU' },
  { keywords: ['tasty corn bread', 'corn bread'], url: 'https://unsplash.com/photos/a-pan-of-food-cooking-in-an-oven-Xu6FyM9ZwQM' },
  { keywords: ['buffalo cauliflower chicken', 'cauliflower chicken'], url: 'https://unsplash.com/photos/two-bowls-of-cauliflower-and-celery-on-a-table-9vErmkJ1yUY' },
  { keywords: ['shrimp pad thai', 'pad thai'], url: 'https://unsplash.com/s/photos/pad-thai' },
  { keywords: ['black forest cake', 'chocolate cake', 'chocolate cherry cake'], url: 'https://unsplash.com/photos/chocolate-cake-with-strawberry-on-white-ceramic-plate-6jHpcBPw7i8' },
];

// Guaranteed pairings for curated template / ingredient ideas.
export const EXACT_TITLE_IMAGES = {
  'creamy steak fettuccine': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80',
  'cheesy margherita pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
  'crispy sesame seed tofu bowl': 'https://unsplash.com/photos/a-bowl-of-food-sitting-on-top-of-a-table-6qtE-gJIZ90',
  'ebi ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
  'crispy chicken chalupas': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
  'black bean quesadilla': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=500&q=80',
  'thai basil chicken': 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80',
  'tomato basil soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80',
  'thai redcurry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
  'roasted bbq rib platter': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80',
  'greek salad bowl': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
  'lemon herb salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80',
  'sheet pan bbq chicken': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80',
  'classic mac and cheese': 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80',
  'mac and cheese': 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80',
  'mac n cheese': 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80',
  'macaroni and cheese': 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80',
  'stovetop mac': 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80',
  'stovetop mac and cheese': 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?w=500&q=80',
  'veggie bowl variety': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
  'quick herb chicken skillet': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80',
  'lemon herb roast chicken': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80',
  'weeknight tomato pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&q=80',
  'fried rice with vegetables': 'https://unsplash.com/photos/bowl-of-fried-rice-oT7_v-I0hHg',
  'crispy tofu stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80',
  'honey garlic glazed salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80',
  'savory steak and veggies': 'https://unsplash.com/photos/cooked-meat-with-vegetable-on-black-plate-v72LQpo03Gw',
  'garlic butter shrimp': 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80',
  'crispy roasted potatoes': 'https://unsplash.com/photos/a-white-plate-topped-with-potatoes-and-parsley-9DEggBoY8CY',
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
