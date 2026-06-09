"""Shared title → stock image mapping for AI suggestion cards (mirrors utils/suggestionImages.js)."""
import re

DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80'

FALLBACK_IMAGES = [
    DEFAULT_FALLBACK_IMAGE,
    'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80',
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
    'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
]

TITLE_IMAGE_KEYWORDS = [
    (('tomato pasta', 'weeknight pasta', 'pasta bolognese', 'meat pasta'), 'https://images.unsplash.com/photo-1695742434600-e0f59629d2bb?w=500&q=80'),
    (('coconut curry soup', 'coconut curry', 'tom yum'), 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80'),
    (('mac and cheese', 'macaroni'), 'https://images.unsplash.com/photo-1543339496-18e0d6816ba7?w=500&q=80'),
    (('pad thai', 'lo mein', 'fried rice'), 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80'),
    (('ginger soy', 'stir-fry', 'stir fry'), 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80'),
    (('sesame noodle', 'sesame'), 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80'),
    (('crispy roasted', 'roasted potato', 'roasted potatoes'), 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80'),
    (('roasted veggie', 'veggie bowl', 'grain bowl'), 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80'),
    (('greek salad', 'salad bowl'), 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80'),
    (('chicken taco', 'chicken tacos', 'weeknight chicken'), 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80'),
    (('quick herb chicken', 'herb chicken', 'chicken skillet', 'roast chicken'), 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80'),
    (('thai basil', 'basil chicken'), 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80'),
    (('black bean quesadilla', 'bean quesadilla'), 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=500&q=80'),
    (('sheet pan', 'bbq chicken'), 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80'),
    (('lemon herb salmon', 'honey garlic salmon', 'glazed salmon'), 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80'),
    (('beef and broccoli', 'beef broccoli'), 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80'),
    (('garlic butter shrimp', 'butter shrimp'), 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80'),
    (('crispy tofu', 'tofu stir'), 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80'),
    (('chickpea curry', 'tandoori'), 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80'),
    (('potato', 'potatoes'), 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80'),
    (('pasta', 'spaghetti', 'lasagna', 'ravioli', 'carbonara', 'penne', 'fettuccine', 'gnocchi'), 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80'),
    (('noodle', 'ramen', 'pho', 'udon'), 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80'),
    (('pizza', 'flatbread', 'margherita', 'calzone'), 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80'),
    (('taco', 'quesadilla', 'burrito', 'enchilada', 'nacho', 'salsa', 'guacamole', 'tortilla'), 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80'),
    (('curry', 'tikka', 'masala', 'biryani', 'korma', 'vindaloo'), 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80'),
    (('coconut',), 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80'),
    (('salmon', 'trout', 'cod', 'tilapia', 'fish'), 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80'),
    (('chicken', 'wing', 'poultry', 'drumstick'), 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80'),
    (('beef', 'steak', 'brisket', 'meatball'), 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80'),
    (('pork', 'bacon', 'ham', 'sausage', 'prosciutto'), 'https://images.unsplash.com/photo-1432130438734-24cdc404168c?w=500&q=80'),
    (('lamb', 'kebab', 'skewer'), 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80'),
    (('shrimp', 'prawn', 'lobster', 'crab', 'seafood'), 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80'),
    (('tofu', 'tempeh'), 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'),
    (('wok',), 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80'),
    (('broccoli',), 'https://images.unsplash.com/photo-1459411552884-e45e3d4613d5?w=500&q=80'),
    (('rice', 'risotto', 'pilaf'), 'https://images.unsplash.com/photo-1603133872877-684f208b89d7?w=500&q=80'),
    (('soup', 'stew', 'chowder', 'bisque', 'broth'), 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80'),
    (('salad', 'slaw', 'greens'), 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80'),
    (('burger', 'sandwich', 'wrap', 'slider'), 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80'),
    (('omelette', 'frittata', 'quiche'), 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80'),
    (('egg',), 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80'),
    (('pancake', 'waffle', 'french toast', 'breakfast'), 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=80'),
    (('dumpling', 'gyoza', 'potsticker', 'bao'), 'https://images.unsplash.com/photo-1496116218413-95a0c151e16a?w=500&q=80'),
    (('sushi', 'sashimi', 'poke'), 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=500&q=80'),
    (('hummus', 'falafel', 'mezze'), 'https://images.unsplash.com/photo-1623428187425-4a3a3e5e5c0d?w=500&q=80'),
    (('mushroom',), 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80'),
    (('chickpea', 'dal', 'bean', 'lentil', 'chili'), 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80'),
    (('avocado',), 'https://images.unsplash.com/photo-1523049673857-eb18f1adf7ae?w=500&q=80'),
    (('corn',), 'https://images.unsplash.com/photo-1551758254-08f81a683d77?w=500&q=80'),
    (('cauliflower',), 'https://images.unsplash.com/photo-1568584711073-975fb5061c86?w=500&q=80'),
    (('bbq', 'grill', 'roasted', 'roast'), 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80'),
    (('thai', 'lemongrass'), 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80'),
    (('basil',), 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80'),
    (('bowl', 'veggie', 'vegetable', 'greek', 'grain'), 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80'),
    (('cake', 'cookie', 'dessert', 'pie', 'brownie'), 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=500&q=80'),
]

EXACT_TITLE_IMAGES = {
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
    'classic mac and cheese': 'https://images.unsplash.com/photo-1543339496-18e0d6816ba7?w=500&q=80',
    'one pan roasted veggie bowl': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
    'quick herb chicken skillet': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80',
    'lemon herb roast chicken': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80',
    'weeknight tomato pasta': 'https://images.unsplash.com/photo-1695742434600-e0f59629d2bb?w=500&q=80',
    'fried rice with vegetables': 'https://images.unsplash.com/photo-1603133872877-684f208b89d7?w=500&q=80',
    'crispy tofu stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80',
    'honey garlic glazed salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80',
    'savory beef and broccoli': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80',
    'garlic butter shrimp': 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80',
    'crispy roasted potatoes': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80',
}

TITLE_STOP_WORDS = {
    'with', 'and', 'the', 'a', 'an', 'your', 'fresh', 'twist', 'easy', 'quick',
    'next', 'level', 'inspired', 'logged', 'dish', 'chef', 'favorite', 'style',
    'one', 'pan', 'weeknight', 'classic', 'savory', 'herb', 'herbs', 'lemon',
    'garlic', 'honey', 'ginger', 'soy', 'spiced', 'glazed', 'crispy', 'roasted',
}

FOOD_TOKEN_HINTS = [
    'pasta', 'noodle', 'noodles', 'pizza', 'taco', 'tacos', 'curry', 'soup', 'stew',
    'salad', 'chicken', 'beef', 'pork', 'salmon', 'shrimp', 'tofu', 'rice', 'bowl',
    'burger', 'sandwich', 'sushi', 'ramen', 'pho', 'quesadilla', 'burrito',
    'dumpling', 'pancake', 'waffle', 'steak', 'fish', 'lobster', 'crab',
    'mushroom', 'broccoli', 'potato', 'potatoes', 'avocado', 'bean', 'beans',
    'lentil', 'chili', 'coconut', 'basil', 'thai', 'macaroni',
]


def normalize_title(title):
    if not title:
        return ''
    normalized = str(title).lower().strip()
    normalized = re.sub(r'[^\w\s]', ' ', normalized)
    return re.sub(r'\s+', ' ', normalized).strip()


def keyword_matches_title(keyword, normalized_title):
    if not keyword or not normalized_title:
        return False
    if ' ' in keyword:
        return keyword in normalized_title
    return re.search(r'\b' + re.escape(keyword) + r'\b', normalized_title) is not None


def _score_keyword_matches(normalized_title):
    best_url = None
    best_length = 0
    for keywords, url in TITLE_IMAGE_KEYWORDS:
        for keyword in keywords:
            if keyword_matches_title(keyword, normalized_title) and len(keyword) > best_length:
                best_length = len(keyword)
                best_url = url
    return best_url


def _token_fallback_image(normalized_title):
    words = normalized_title.split()
    for hint in FOOD_TOKEN_HINTS:
        if hint in words:
            for keywords, url in TITLE_IMAGE_KEYWORDS:
                if hint in keywords:
                    return url

    for word in words:
        if len(word) < 4 or word in TITLE_STOP_WORDS:
            continue
        for keywords, url in TITLE_IMAGE_KEYWORDS:
            if word in keywords and ' ' not in word:
                return url
    return None


def title_fallback_image(recipe_name):
    normalized_title = normalize_title(recipe_name)
    if not normalized_title:
        return DEFAULT_FALLBACK_IMAGE

    if normalized_title in EXACT_TITLE_IMAGES:
        return EXACT_TITLE_IMAGES[normalized_title]

    scored = _score_keyword_matches(normalized_title)
    if scored:
        return scored

    token_match = _token_fallback_image(normalized_title)
    if token_match:
        return token_match

    idx = sum(ord(char) for char in normalized_title) % len(FALLBACK_IMAGES)
    return FALLBACK_IMAGES[idx]


def title_matched_image(recipe_name):
    image = title_fallback_image(recipe_name)
    if isinstance(image, str) and image.strip().lower().startswith('https://') and len(image.strip()) > 12:
        return image
    return DEFAULT_FALLBACK_IMAGE
