from http.server import BaseHTTPRequestHandler
import json
import os
import re
from collections import Counter
from datetime import datetime

# Import Firebase Admin SDK
from firebase_admin import firestore
import firebase_admin
from firebase_admin import credentials

# Initialize Firebase Admin SDK
db = None
try:
    if not firebase_admin._apps:
        if 'GOOGLE_SERVICE_ACCOUNT' in os.environ:
            # Production environment (Vercel)
            cred_dict = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT'])
            cred = credentials.Certificate(cred_dict)
        else:
            # Local development
            cred = credentials.Certificate('../serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f'Firebase initialization error: {e}')
    # db will be None, which will cause errors in the handler

# Stock images when no photo is available (no vision API — semantic matching only).
FALLBACK_IMAGES = [
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80',
    'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80',
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
    'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
]

# Keyword → Unsplash image so fallback photos match the recipe title.
TITLE_IMAGE_KEYWORDS = [
    (('potato', 'potatoes'), 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80'),
    (('pasta', 'spaghetti', 'mac and cheese', 'mac'), 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80'),
    (('noodle', 'ramen', 'pho', 'udon', 'sesame'), 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80'),
    (('pizza', 'flatbread', 'margherita'), 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80'),
    (('taco', 'quesadilla', 'burrito', 'salsa', 'guacamole'), 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80'),
    (('curry', 'tikka', 'masala', 'tandoori', 'chickpea', 'dal', 'coconut'), 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80'),
    (('salmon', 'fish'), 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80'),
    (('chicken', 'wing'), 'https://images.unsplash.com/photo-1598103442097-257256dee282?w=500&q=80'),
    (('beef', 'steak', 'broccoli'), 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80'),
    (('shrimp', 'prawn'), 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80'),
    (('tofu', 'stir-fry', 'stir fry', 'ginger soy'), 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80'),
    (('rice', 'fried rice', 'biryani'), 'https://images.unsplash.com/photo-1603133872877-684f208b89d7?w=500&q=80'),
    (('salad', 'bowl', 'veggie', 'vegetable', 'greek'), 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80'),
    (('soup',), 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80'),
    (('bbq', 'grill', 'sheet pan'), 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80'),
    (('basil', 'thai'), 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80'),
]

# Curated ideas used when the community pool has no strong matches.
CUISINE_TEMPLATES = {
    'italian': [
        {'name': 'Creamy Garlic Pasta', 'ingredients': 'pasta, garlic, cream, parmesan, olive oil', 'cooking_time': '25 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80'},
        {'name': 'Margherita Flatbread', 'ingredients': 'pizza dough, tomato sauce, mozzarella, basil', 'cooking_time': '30 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80'},
    ],
    'asian': [
        {'name': 'Ginger Soy Stir-Fry', 'ingredients': 'rice, soy sauce, ginger, garlic, vegetables', 'cooking_time': '20 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80'},
        {'name': 'Sesame Noodle Bowl', 'ingredients': 'noodles, sesame oil, scallions, soy sauce, cucumber', 'cooking_time': '15 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80'},
    ],
    'mexican': [
        {'name': 'Weeknight Chicken Tacos', 'ingredients': 'chicken, corn tortillas, lime, cilantro, onion', 'cooking_time': '25 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80'},
        {'name': 'Black Bean Quesadilla', 'ingredients': 'tortillas, black beans, cheese, salsa, avocado', 'cooking_time': '15 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=500&q=80'},
    ],
    'thai': [
        {'name': 'Thai Basil Chicken', 'ingredients': 'chicken, basil, garlic, chili, soy sauce, rice', 'cooking_time': '25 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1559317152-202d30895b0a?w=500&q=80'},
        {'name': 'Coconut Curry Soup', 'ingredients': 'coconut milk, curry paste, vegetables, lime, cilantro', 'cooking_time': '30 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80'},
    ],
    'indian': [
        {'name': 'Chickpea Curry', 'ingredients': 'chickpeas, tomato, onion, garlic, curry spices, rice', 'cooking_time': '35 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80'},
        {'name': 'Tandoori-Spiced Sheet Pan Dinner', 'ingredients': 'chicken, yogurt, tandoori spice, potatoes, lemon', 'cooking_time': '40 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80'},
    ],
    'mediterranean': [
        {'name': 'Greek Salad Bowl', 'ingredients': 'cucumber, tomato, feta, olives, red onion, olive oil', 'cooking_time': '15 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80'},
        {'name': 'Lemon Herb Salmon', 'ingredients': 'salmon, lemon, olive oil, garlic, herbs, quinoa', 'cooking_time': '25 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80'},
    ],
    'american': [
        {'name': 'Sheet Pan BBQ Chicken', 'ingredients': 'chicken, bbq sauce, potatoes, corn, butter', 'cooking_time': '35 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80'},
        {'name': 'Classic Mac and Cheese', 'ingredients': 'pasta, cheddar, milk, butter, flour', 'cooking_time': '30 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1543339496-18e0d6816ba7?w=500&q=80'},
    ],
    'general': [
        {'name': 'One-Pan Roasted Veggie Bowl', 'ingredients': 'seasonal vegetables, olive oil, garlic, rice, herbs', 'cooking_time': '30 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80'},
        {'name': 'Quick Herb Chicken Skillet', 'ingredients': 'chicken, onion, garlic, herbs, lemon', 'cooking_time': '25 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1598103442097-257256dee282?w=500&q=80'},
    ],
}

INGREDIENT_IDEAS = {
    'chicken': {'name': 'Lemon Herb Roast Chicken', 'ingredients': 'chicken, lemon, garlic, rosemary, olive oil', 'cooking_time': '45 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1598103442097-257256dee282?w=500&q=80'},
    'pasta': {'name': 'Weeknight Tomato Pasta', 'ingredients': 'pasta, tomatoes, garlic, basil, olive oil', 'cooking_time': '20 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80'},
    'rice': {'name': 'Fried Rice with Vegetables', 'ingredients': 'rice, eggs, soy sauce, peas, carrots, scallions', 'cooking_time': '20 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1603133872877-684f208b89d7?w=500&q=80'},
    'tofu': {'name': 'Crispy Tofu Stir-Fry', 'ingredients': 'tofu, soy sauce, ginger, broccoli, sesame oil', 'cooking_time': '25 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80'},
    'salmon': {'name': 'Honey Garlic Glazed Salmon', 'ingredients': 'salmon, honey, garlic, soy sauce, rice', 'cooking_time': '20 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80'},
    'beef': {'name': 'Savory Beef and Broccoli', 'ingredients': 'beef, broccoli, soy sauce, garlic, rice', 'cooking_time': '25 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80'},
    'shrimp': {'name': 'Garlic Butter Shrimp', 'ingredients': 'shrimp, butter, garlic, lemon, parsley, pasta', 'cooking_time': '15 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1565680018434-b698cbd2771?w=500&q=80'},
    'potato': {'name': 'Crispy Roasted Potatoes', 'ingredients': 'potatoes, olive oil, rosemary, garlic, salt', 'cooking_time': '35 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80'},
}


class SmartSuggestionsEngine:
    """Smart Suggestions Engine for recipe recommendations"""

    def __init__(self):
        self.cuisine_keywords = {
            'italian': ['pasta', 'pizza', 'risotto', 'bruschetta', 'tiramisu', 'lasagna', 'ravioli'],
            'asian': ['sushi', 'stir-fry', 'stir fry', 'curry', 'dumplings', 'ramen', 'pho', 'teriyaki', 'noodles'],
            'mexican': ['tacos', 'enchiladas', 'guacamole', 'quesadilla', 'churros', 'burrito', 'salsa'],
            'thai': ['pad thai', 'tom yum', 'green curry', 'mango sticky rice', 'thai', 'basil'],
            'indian': ['curry', 'naan', 'biryani', 'samosa', 'dal', 'tandoori', 'masala'],
            'french': ['croissant', 'quiche', 'ratatouille', 'coq au vin', 'creme brulee'],
            'mediterranean': ['hummus', 'falafel', 'paella', 'tzatziki', 'baklava', 'feta', 'olives'],
            'american': ['burger', 'bbq', 'apple pie', 'mac and cheese', 'chicken wings', 'grilled cheese'],
        }

    def _normalize_ingredients(self, ingredients):
        """Turn log/community ingredients into a list of lowercase tokens."""
        if not ingredients:
            return []
        if isinstance(ingredients, list):
            raw_items = [str(item) for item in ingredients if item is not None and item != '']
        else:
            raw = str(ingredients).strip()
            if not raw:
                return []
            raw_items = re.split(r'[\r\n,;•·]|\band\b', raw, flags=re.IGNORECASE)

        tokens = []
        for item in raw_items:
            cleaned = re.sub(r'^[-–—•·]+\s*', '', str(item).strip().lower())
            if cleaned:
                tokens.append(cleaned)
        return tokens

    def _normalize_title(self, title):
        """Normalize a dish title for fuzzy duplicate detection."""
        if not title:
            return ''
        normalized = str(title).lower().strip()
        normalized = re.sub(r'[^\w\s]', ' ', normalized)
        return re.sub(r'\s+', ' ', normalized).strip()

    _TITLE_STOP_WORDS = {
        'with', 'and', 'the', 'a', 'an', 'your', 'fresh', 'twist', 'easy', 'quick',
        'next', 'level', 'inspired', 'logged', 'dish', 'chef', 'favorite', 'style',
    }

    def _title_keywords(self, title):
        words = self._normalize_title(title).split()
        return {word for word in words if len(word) >= 3 and word not in self._TITLE_STOP_WORDS}

    def _titles_similar(self, title_a, title_b):
        """Case-insensitive fuzzy match: exact, substring, or shared dish keywords."""
        a = self._normalize_title(title_a)
        b = self._normalize_title(title_b)
        if not a or not b:
            return False
        if a == b:
            return True
        shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
        if len(shorter) >= 4 and shorter in longer:
            return True

        keywords_a = self._title_keywords(title_a)
        keywords_b = self._title_keywords(title_b)
        if not keywords_a or not keywords_b:
            return False
        overlap = keywords_a & keywords_b
        if len(overlap) >= 2:
            return True
        if len(overlap) == 1 and (len(keywords_a) <= 2 or len(keywords_b) <= 2):
            return True
        return False

    def _ingredient_overlap_ratio(self, tokens_a, tokens_b):
        if not tokens_a or not tokens_b:
            return 0.0
        set_a = set(tokens_a)
        set_b = set(tokens_b)
        overlap = set_a & set_b
        if not overlap:
            for token_a in tokens_a:
                for token_b in tokens_b:
                    if token_a in token_b or token_b in token_a:
                        overlap.add(token_a)
        denominator = max(len(set_a), len(set_b), 1)
        return len(overlap) / denominator

    def _build_tried_profile(self, username, logs):
        """Everything the user has already cooked — titles, ids, ingredients, photos."""
        normalized_titles = set()
        log_ids = set()
        recipe_ids = set()
        log_entries = []
        log_photos = set()

        for log in logs:
            title = (log.get('title') or '').strip()
            if not title:
                continue
            normalized_titles.add(self._normalize_title(title))
            log_ids.add(str(log.get('id') or ''))
            for field in ('recipe_id', 'recipeId', 'source_recipe_id'):
                value = log.get(field)
                if value is not None and value != '':
                    recipe_ids.add(str(value))
            photo = log.get('photoUrl')
            if photo:
                log_photos.add(photo)
            log_entries.append({
                'title': title,
                'tokens': self._normalize_ingredients(log.get('ingredients')),
                'id': str(log.get('id') or ''),
            })

        cooked_titles = {title for title in normalized_titles if title}
        try:
            recipes_ref = db.collection('recipe_posts').where('username', '==', username).stream()
            for recipe in recipes_ref:
                recipe_name = self._normalize_title(recipe.to_dict().get('recipe_name') or '')
                if recipe_name:
                    cooked_titles.add(recipe_name)
                    normalized_titles.add(recipe_name)
        except Exception as e:
            print(f"Error getting cooked titles from recipe_posts: {str(e)}")

        return {
            'normalized_titles': normalized_titles,
            'cooked_titles': cooked_titles,
            'log_ids': {item for item in log_ids if item},
            'recipe_ids': recipe_ids,
            'log_entries': log_entries,
            'log_photos': log_photos,
        }

    def _is_already_tried(self, name, ingredients, recipe_id, tried_profile):
        """Skip dishes the user has logged or that are too close to a prior meal."""
        normalized = self._normalize_title(name)
        if not normalized:
            return True

        if normalized in tried_profile.get('normalized_titles', set()):
            return True
        if normalized in tried_profile.get('cooked_titles', set()):
            return True

        candidate_id = str(recipe_id or '').strip()
        if candidate_id:
            if candidate_id in tried_profile.get('log_ids', set()):
                return True
            if candidate_id in tried_profile.get('recipe_ids', set()):
                return True
            if candidate_id.startswith('log-variant-'):
                return True

        candidate_tokens = self._normalize_ingredients(ingredients)
        for entry in tried_profile.get('log_entries', []):
            if self._titles_similar(name, entry['title']):
                return True
            if candidate_tokens and entry.get('tokens'):
                overlap_ratio = self._ingredient_overlap_ratio(candidate_tokens, entry['tokens'])
                shared = len(set(candidate_tokens) & set(entry['tokens']))
                if overlap_ratio >= 0.55 and shared >= 3:
                    return True
                if overlap_ratio >= 0.7 and self._title_keywords(name) & self._title_keywords(entry['title']):
                    return True

        return False

    def _ingredient_overlap_score(self, candidate_tokens, user_tokens):
        """Score 0-40 based on shared ingredient keywords."""
        if not user_tokens or not candidate_tokens:
            return 0.0
        user_set = set(user_tokens)
        candidate_set = set(candidate_tokens)
        overlap = user_set & candidate_set
        if not overlap:
            # Partial substring matches (e.g. "chicken breast" ~ "chicken")
            for user_token in user_tokens:
                for candidate_token in candidate_tokens:
                    if user_token in candidate_token or candidate_token in user_token:
                        overlap.add(user_token)
        ratio = len(overlap) / max(len(user_set), 1)
        return min(40.0, ratio * 40 + len(overlap) * 4)

    def _get_user_logs(self, username, limit=50):
        """Fetch logged meals newest-first with fields used for taste analysis."""
        logs = []
        try:
            try:
                logs_ref = (
                    db.collection('logs')
                    .where('username', '==', username)
                    .order_by('createdAt', direction=firestore.Query.DESCENDING)
                    .limit(limit)
                    .stream()
                )
            except Exception:
                logs_ref = db.collection('logs').where('username', '==', username).stream()

            for doc in logs_ref:
                data = doc.to_dict() or {}
                title = (data.get('title') or '').strip()
                if not title:
                    continue
                logs.append({
                    'id': doc.id,
                    'title': title,
                    'ingredients': data.get('ingredients'),
                    'photoUrl': data.get('photoUrl') or data.get('photo_url') or data.get('image'),
                    'rating': data.get('rating'),
                    'difficulty': data.get('difficulty') or data.get('difficulty_level'),
                    'time': data.get('time') or data.get('cooking_time'),
                    'notes': data.get('notes') or data.get('cooking_notes') or '',
                    'createdAt': data.get('createdAt') or data.get('created_at'),
                })
        except Exception as e:
            print(f"Error getting user logs: {str(e)}")

        logs.sort(key=lambda log: self._timestamp_sort_key(log.get('createdAt')), reverse=True)
        return logs[:limit]

    def _timestamp_sort_key(self, timestamp):
        if not timestamp:
            return 0
        try:
            if hasattr(timestamp, 'timestamp'):
                return timestamp.timestamp()
            if hasattr(timestamp, 'seconds'):
                return timestamp.seconds
            if hasattr(timestamp, 'toMillis'):
                return timestamp.toMillis() / 1000
        except Exception:
            pass
        return 0

    def _build_log_profile(self, logs):
        """Analyze logged meals: ingredients, cuisines, difficulty, and photos."""
        ingredient_counter = Counter()
        cuisine_counter = Counter()
        cooked_titles = set()
        photo_by_cuisine = {}
        ratings = []
        difficulties = []
        times = []

        for log in logs:
            title_lower = log['title'].lower().strip()
            cooked_titles.add(title_lower)
            ingredients = self._normalize_ingredients(log.get('ingredients'))
            for token in ingredients:
                ingredient_counter[token] += 1

            cuisines = self._detect_cuisines(title_lower, ingredients)
            for cuisine in cuisines:
                cuisine_counter[cuisine] += 1
                if log.get('photoUrl') and cuisine not in photo_by_cuisine:
                    photo_by_cuisine[cuisine] = log['photoUrl']

            if log.get('rating'):
                try:
                    ratings.append(float(log['rating']))
                except (TypeError, ValueError):
                    pass
            if log.get('difficulty'):
                difficulties.append(str(log['difficulty']).lower())
            if log.get('time'):
                times.append(str(log['time']))

        top_cuisines = [cuisine for cuisine, _ in cuisine_counter.most_common(3)]
        if not top_cuisines:
            top_cuisines = ['general']

        return {
            'cooked_titles': cooked_titles,
            'ingredient_tokens': [token for token, _ in ingredient_counter.most_common(20)],
            'ingredient_counter': ingredient_counter,
            'top_cuisines': top_cuisines,
            'photo_by_cuisine': photo_by_cuisine,
            'log_photos': {log['photoUrl'] for log in logs if log.get('photoUrl')},
            'avg_rating': sum(ratings) / len(ratings) if ratings else None,
            'preferred_difficulty': Counter(difficulties).most_common(1)[0][0] if difficulties else 'medium',
            'typical_time': times[0] if times else '30 min',
        }

    
    def _get_followed_users(self, username):
        """Get list of users that the current user follows"""
        followed_users = []
        
        try:
            following_ref = db.collection('following').document(username).collection('user_following').stream()
            followed_users = [followed.id for followed in following_ref]
        except Exception as e:
            print(f"Error getting followed users: {str(e)}")
        
        return followed_users
    
    def _get_friends_recipes(self, followed_users):
        """Get recipes from friends (followed users)"""
        friends_recipes = []
        
        try:
            if not followed_users:
                return friends_recipes
            
            # Firestore 'in' query limit is 10, so we need to batch if more than 10
            for i in range(0, len(followed_users), 10):
                batch = followed_users[i:i+10]
                recipes_ref = db.collection('recipe_posts').where('username', 'in', batch).stream()
                
                for recipe in recipes_ref:
                    recipe_data = recipe.to_dict()
                    friends_recipes.append(recipe_data)
        
        except Exception as e:
            print(f"Error getting friends recipes: {str(e)}")
        
        return friends_recipes
    
    def _detect_cuisines(self, recipe_name, ingredients=None):
        """Detect cuisine types from recipe name and ingredients."""
        recipe_lower = (recipe_name or '').lower()
        detected_cuisines = []

        for cuisine, keywords in self.cuisine_keywords.items():
            if any(keyword in recipe_lower for keyword in keywords):
                detected_cuisines.append(cuisine)

        if ingredients:
            if isinstance(ingredients, list):
                ingredients_str = ' '.join(str(i) for i in ingredients).lower()
            else:
                ingredients_str = str(ingredients).lower()
            for cuisine, keywords in self.cuisine_keywords.items():
                if any(keyword in ingredients_str for keyword in keywords):
                    if cuisine not in detected_cuisines:
                        detected_cuisines.append(cuisine)

        return detected_cuisines or ['general']

    def _detect_cuisine(self, recipe_name, ingredients=None):
        """Primary cuisine for backward-compatible scoring."""
        cuisines = self._detect_cuisines(recipe_name, ingredients)
        return cuisines[0] if cuisines else 'general'
    
    def _calculate_suggestion_score(self, recipe, user_recipes, user_preferences=None):
        """Calculate a score for how good this suggestion is (0-100)"""
        score = 0.0
        recipe_name = (recipe.get('recipe_name') or '').strip()
        normalized_name = self._normalize_title(recipe_name)

        # Skip if user has already cooked this (exact normalized title)
        if normalized_name in user_recipes:
            return 0.0
        
        # Score based on rating (0-40 points)
        rating = recipe.get('rating', 0)
        if rating >= 4.5:
            score += 40
        elif rating >= 4.0:
            score += 30
        elif rating >= 3.5:
            score += 20
        elif rating >= 3.0:
            score += 10
        
        # Score based on recook count (popularity) (0-20 points)
        recooks = recipe.get('recooks_count', 0)
        if recooks >= 5:
            score += 20
        elif recooks >= 3:
            score += 15
        elif recooks >= 1:
            score += 10
        
        # Score based on recency (recently cooked = more relevant) (0-20 points)
        created_at = recipe.get('created_at')
        if created_at:
            try:
                if hasattr(created_at, 'timestamp'):
                    # Firestore Timestamp
                    recipe_date = datetime.fromtimestamp(created_at.timestamp())
                elif hasattr(created_at, 'seconds'):
                    # Firestore Timestamp with seconds attribute
                    recipe_date = datetime.fromtimestamp(created_at.seconds)
                else:
                    # Try string parsing
                    created_str = str(created_at)
                    if 'T' in created_str:
                        recipe_date = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                    else:
                        recipe_date = None
                
                if recipe_date:
                    # Remove timezone info for comparison
                    if recipe_date.tzinfo:
                        recipe_date = recipe_date.replace(tzinfo=None)
                    days_ago = (datetime.now() - recipe_date).days
                    if days_ago <= 7:
                        score += 20
                    elif days_ago <= 30:
                        score += 15
                    elif days_ago <= 90:
                        score += 10
            except Exception as e:
                print(f"Error parsing date: {str(e)}")
                pass
        
        # Score based on likes (0-10 points)
        likes = recipe.get('likes_count', 0)
        if likes >= 10:
            score += 10
        elif likes >= 5:
            score += 7
        elif likes >= 1:
            score += 5
        
        # Score based on user preferences if available (0-10 points)
        if user_preferences:
            recipe_cuisine = self._detect_cuisine(
                recipe_name.lower(), recipe.get('ingredients', [])
            )
            if recipe_cuisine in user_preferences.get('top_cuisines', []):
                score += 10
        
        return score
    
    def _get_user_preferences(self, username, log_profile):
        """Load kitchen personality preferences, falling back to log-inferred cuisines."""
        top_cuisines = []
        favorite_ingredients = []
        try:
            user_ref = db.collection('users').document(username).get()
            if user_ref.exists:
                user_data = user_ref.to_dict() or {}
                personality = user_data.get('kitchen_personality', {}) or {}
                if user_data.get('top_cuisines_user_set'):
                    top_cuisines = personality.get('top_cuisines', [])
                if user_data.get('favorite_ingredients_user_set'):
                    favorite_ingredients = personality.get('favorite_ingredients', [])
        except Exception as e:
            print(f"Error loading user preferences: {str(e)}")

        if not top_cuisines:
            top_cuisines = log_profile.get('top_cuisines', ['general'])
        if not favorite_ingredients:
            favorite_ingredients = log_profile.get('ingredient_tokens', [])[:5]

        top_cuisines = [str(cuisine) for cuisine in top_cuisines if cuisine]
        favorite_ingredients = [str(ingredient) for ingredient in favorite_ingredients if ingredient]

        return {
            'top_cuisines': top_cuisines,
            'favorite_ingredients': favorite_ingredients,
            'preferred_difficulty': log_profile.get('preferred_difficulty', 'medium'),
            'typical_time': log_profile.get('typical_time', '30 min'),
        }

    def _title_fallback_image(self, recipe_name):
        """Pick a stock photo that matches the recipe title keywords."""
        title_lower = self._normalize_title(recipe_name)
        if title_lower:
            for keywords, url in TITLE_IMAGE_KEYWORDS:
                if any(keyword in title_lower for keyword in keywords):
                    return url
            idx = sum(ord(char) for char in title_lower) % len(FALLBACK_IMAGES)
            return FALLBACK_IMAGES[idx]
        return FALLBACK_IMAGES[0]

    def _recipe_image(self, recipe, blocked_urls=None):
        """Resolve image from the same recipe source; never reuse the user's own log photos."""
        blocked = set(blocked_urls or [])
        recipe_name = (
            recipe.get('recipe_name')
            or recipe.get('name')
            or recipe.get('title')
            or ''
        )
        for field in ('image', 'photoUrl', 'photo_url', 'dish_photo_url'):
            url = recipe.get(field)
            if url and url not in blocked:
                return url
        return self._title_fallback_image(recipe_name)

    def _format_subtitle(self, recipe):
        difficulty = recipe.get('difficulty_level') or recipe.get('difficulty') or ''
        cooking_time = recipe.get('cooking_time') or recipe.get('time') or ''
        parts = []
        if difficulty not in (None, ''):
            parts.append(str(difficulty).capitalize())
        if cooking_time not in (None, ''):
            parts.append(str(cooking_time))
        return ', '.join(parts) if parts else 'Suggested for you'

    def _display_cuisine(self, cuisine):
        """Human-readable cuisine label for suggestion copy."""
        if not cuisine or cuisine == 'general':
            return ''
        return str(cuisine).replace('_', ' ').capitalize()

    def _join_reason_clauses(self, clauses):
        """Join reason clauses for 'Suggested because …' without repeating 'it is'."""
        if not clauses:
            return ''
        if len(clauses) == 1:
            return clauses[0]
        head = clauses[0]
        tail = []
        for clause in clauses[1:]:
            lowered = clause
            for prefix in ('it is ', 'it was ', 'it '):
                if lowered.startswith(prefix):
                    lowered = lowered[len(prefix):]
                    break
            tail.append(lowered)
        if len(tail) == 1:
            return f'{head}, and {tail[0]}'
        return f'{head}, {", ".join(tail[:-1])}, and {tail[-1]}'

    def _format_suggestion(self, recipe, score, why_suggested, blocked_urls=None):
        """Normalize a recipe document into a suggestion payload."""
        recipe_name = recipe.get('recipe_name') or recipe.get('title') or recipe.get('name') or 'Recipe'
        ingredients = recipe.get('ingredients')
        if isinstance(ingredients, list):
            ingredients_value = ingredients
        elif ingredients:
            ingredients_value = ingredients
        else:
            ingredients_value = ''

        return {
            'id': recipe.get('id') or recipe.get('recipe_id') or '',
            'recipe_name': recipe_name,
            'name': recipe_name,
            'recipe_id': recipe.get('id') or recipe.get('recipe_id') or '',
            'username': recipe.get('username', ''),
            'rating': recipe.get('rating', 0),
            'cooking_notes': recipe.get('cooking_notes') or recipe.get('notes') or '',
            'difficulty_level': recipe.get('difficulty_level') or recipe.get('difficulty') or 'medium',
            'cooking_time': recipe.get('cooking_time') or recipe.get('time') or '',
            'ingredients': ingredients_value,
            'steps': recipe.get('steps') or recipe.get('instructions') or '',
            'image': self._recipe_image(recipe, blocked_urls),
            'subtitle': self._format_subtitle(recipe),
            'recooks_count': recipe.get('recooks_count', 0),
            'likes_count': recipe.get('likes_count', 0),
            'created_at': self._format_timestamp(recipe.get('created_at') or recipe.get('createdAt')),
            'suggestion_score': round(score, 2),
            'why_suggested': why_suggested,
        }

    def _calculate_preference_score(self, recipe, tried_profile, log_profile, user_preferences):
        """Score how well a recipe matches the user's logged cooking history."""
        recipe_name = (recipe.get('recipe_name') or recipe.get('title') or '').strip()
        recipe_id = recipe.get('id') or recipe.get('recipe_id') or ''
        if self._is_already_tried(recipe_name, recipe.get('ingredients'), recipe_id, tried_profile):
            return 0.0

        cooked_titles = tried_profile.get('cooked_titles', set())
        score = self._calculate_suggestion_score(
            recipe, cooked_titles, user_preferences
        )
        if score <= 0:
            score = 5.0

        candidate_ingredients = self._normalize_ingredients(recipe.get('ingredients'))
        score += self._ingredient_overlap_score(
            candidate_ingredients,
            log_profile.get('ingredient_tokens', []),
        )

        top_cuisines = user_preferences.get('top_cuisines', [])
        recipe_cuisines = self._detect_cuisines(
            recipe_name.lower(), candidate_ingredients
        )
        if any(cuisine in top_cuisines for cuisine in recipe_cuisines):
            score += 20

        favorite_ingredients = user_preferences.get('favorite_ingredients', [])
        if favorite_ingredients and candidate_ingredients:
            fav_set = set(favorite_ingredients)
            cand_set = set(candidate_ingredients)
            if fav_set & cand_set:
                score += 10

        return score

    def _score_community_recipes(self, username, log_profile, tried_profile, user_preferences, limit):
        """Match community recipe_posts against ingredients/cuisines from user logs."""
        scored_suggestions = []
        seen_recipes = set()
        top_cuisines = user_preferences.get('top_cuisines', [])

        try:
            recipes_ref = db.collection('recipe_posts').limit(300).stream()
            for recipe in recipes_ref:
                recipe_data = recipe.to_dict() or {}
                recipe_data['id'] = recipe.id
                recipe_name = (recipe_data.get('recipe_name') or '').strip()
                normalized_name = self._normalize_title(recipe_name)
                if not normalized_name:
                    continue
                if recipe_data.get('username', '') == username:
                    continue
                if self._is_already_tried(
                    recipe_name,
                    recipe_data.get('ingredients'),
                    recipe_data.get('id'),
                    tried_profile,
                ):
                    continue
                if normalized_name in seen_recipes:
                    continue

                seen_recipes.add(normalized_name)
                score = self._calculate_preference_score(
                    recipe_data, tried_profile, log_profile, user_preferences
                )
                if score <= 0:
                    continue

                recipe_cuisine = self._detect_cuisine(
                    recipe_name.lower(), recipe_data.get('ingredients', [])
                )
                cuisine_label = self._display_cuisine(recipe_cuisine)
                if recipe_cuisine in top_cuisines and cuisine_label:
                    reason = f'it matches your love of {cuisine_label} flavors'
                elif log_profile.get('ingredient_tokens'):
                    reason = 'it shares ingredients with meals you have logged'
                else:
                    reason = 'it was picked from what you have been cooking lately'

                scored_suggestions.append({
                    'score': score,
                    'recipe': recipe_data,
                    'reason': reason,
                })
        except Exception as e:
            print(f"Error scoring community recipes: {str(e)}")

        scored_suggestions.sort(key=lambda item: item['score'], reverse=True)
        return scored_suggestions[:limit]

    def _generate_from_log_patterns(self, log_profile, tried_profile, needed, existing_names):
        """Generate new template suggestions from ingredient/cuisine patterns (no log variants)."""
        generated = []
        seen_names = {self._normalize_title(name) for name in existing_names}
        blocked_urls = tried_profile.get('log_photos', set())

        def add_suggestion(recipe_dict, score, reason):
            name = (recipe_dict.get('recipe_name') or recipe_dict.get('name') or '').strip()
            if not name:
                return False
            if self._is_already_tried(
                name,
                recipe_dict.get('ingredients'),
                recipe_dict.get('id'),
                tried_profile,
            ):
                return False
            normalized_name = self._normalize_title(name)
            if normalized_name in seen_names:
                return False
            seen_names.add(normalized_name)
            generated.append(
                self._format_suggestion(recipe_dict, score, reason, blocked_urls)
            )
            return True

        # Top-ingredient ideas — stock images only (no user log photos).
        for token, _ in log_profile.get('ingredient_counter', Counter()).most_common(8):
            if len(generated) >= needed:
                break
            for key, idea in INGREDIENT_IDEAS.items():
                if key not in token:
                    continue
                idea_recipe = {
                    'id': f'ingredient-{key}',
                    **idea,
                }
                if add_suggestion(
                    idea_recipe,
                    65,
                    f'it features {token}, an ingredient you cook with often',
                ):
                    break

        # Cuisine templates aligned with detected log cuisines.
        for cuisine in log_profile.get('top_cuisines', ['general']):
            if len(generated) >= needed:
                break
            templates = CUISINE_TEMPLATES.get(cuisine, CUISINE_TEMPLATES['general'])
            for template in templates:
                if len(generated) >= needed:
                    break
                template_recipe = {
                    'id': f'cuisine-{cuisine}-{template["name"].lower().replace(" ", "-")}',
                    'recipe_name': template['name'],
                    'ingredients': template['ingredients'],
                    'cooking_time': template['cooking_time'],
                    'difficulty_level': template['difficulty_level'],
                    'image': template.get('image'),
                }
                cuisine_label = self._display_cuisine(cuisine)
                add_suggestion(
                    template_recipe,
                    60,
                    f'it fits your recent {cuisine_label} cooking'
                    if cuisine_label
                    else 'it is based on your recent meals',
                )

        # General fallback so first-log users always see picks.
        for template in CUISINE_TEMPLATES['general']:
            if len(generated) >= needed:
                break
            template_recipe = {
                'id': f'fallback-{template["name"].lower().replace(" ", "-")}',
                **template,
            }
            add_suggestion(
                template_recipe,
                50,
                'it is a great next meal based on what you have been cooking',
            )

        return generated[:needed]

    def _get_preference_suggestions(self, username, logs, limit=6):
        """Suggest meals from community pool + log-pattern analysis."""
        if not logs:
            return []

        log_profile = self._build_log_profile(logs)
        tried_profile = self._build_tried_profile(username, logs)
        user_preferences = self._get_user_preferences(username, log_profile)
        blocked_urls = tried_profile.get('log_photos', set())

        community_hits = self._score_community_recipes(
            username, log_profile, tried_profile, user_preferences, limit
        )

        suggestions = []
        existing_names = []
        for hit in community_hits:
            existing_names.append(hit['recipe'].get('recipe_name', ''))
            suggestions.append(
                self._format_suggestion(hit['recipe'], hit['score'], hit['reason'], blocked_urls)
            )

        target_count = max(3, min(limit, 6))
        if len(suggestions) < target_count:
            needed = target_count - len(suggestions)
            generated = self._generate_from_log_patterns(
                log_profile, tried_profile, needed, existing_names
            )
            suggestions.extend(generated)

        return suggestions[:limit]

    def _get_friend_suggestions(self, username, tried_profile, log_profile, followed_users, limit=6):
        """Suggest recipes from people the user follows."""
        if not followed_users:
            return []

        friends_recipes = self._get_friends_recipes(followed_users)
        if not friends_recipes:
            return []

        user_preferences = self._get_user_preferences(username, log_profile)
        cooked_titles = tried_profile.get('cooked_titles', set())
        blocked_urls = tried_profile.get('log_photos', set())
        scored_suggestions = []
        seen_recipes = set()

        for recipe in friends_recipes:
            recipe_name = (recipe.get('recipe_name') or '').strip()
            normalized_name = self._normalize_title(recipe_name)
            if not normalized_name or normalized_name in seen_recipes:
                continue
            if self._is_already_tried(
                recipe_name,
                recipe.get('ingredients'),
                recipe.get('id') or recipe.get('recipe_id'),
                tried_profile,
            ):
                continue

            seen_recipes.add(normalized_name)
            score = self._calculate_suggestion_score(recipe, cooked_titles, user_preferences)
            if score <= 0:
                continue

            scored_suggestions.append(
                self._format_suggestion(
                    recipe,
                    score,
                    self._get_suggestion_reason(recipe, score),
                    blocked_urls,
                )
            )

        scored_suggestions.sort(key=lambda x: x['suggestion_score'], reverse=True)
        return scored_suggestions[:limit]

    def get_suggestions(self, username, limit=10):
        """Get smart suggestions for a user (preferences + friends)."""
        try:
            logs = self._get_user_logs(username)
            has_logs = len(logs) >= 1
            log_profile = self._build_log_profile(logs) if logs else {}
            tried_profile = self._build_tried_profile(username, logs)
            followed_users = self._get_followed_users(username)

            preference_suggestions = []
            if has_logs:
                preference_suggestions = self._get_preference_suggestions(
                    username, logs, limit
                )

            friend_suggestions = []
            if followed_users:
                friend_suggestions = self._get_friend_suggestions(
                    username, tried_profile, log_profile, followed_users, limit
                )

            return {
                'preference_suggestions': preference_suggestions,
                'friend_suggestions': friend_suggestions,
                # Backward-compatible alias for older clients.
                'suggestions': friend_suggestions,
                'has_logs': has_logs,
                'logs_count': len(logs),
                'total_preference_suggestions': len(preference_suggestions),
                'total_friend_suggestions': len(friend_suggestions),
                'total_friends': len(followed_users),
            }

        except Exception as e:
            print(f"Error generating suggestions: {str(e)}")
            return {
                'preference_suggestions': [],
                'friend_suggestions': [],
                'suggestions': [],
                'has_logs': False,
                'error': str(e),
                'message': 'Error generating suggestions',
            }
    
    def _format_timestamp(self, timestamp):
        """Format Firestore timestamp to ISO string"""
        if not timestamp:
            return ''
        try:
            if hasattr(timestamp, 'isoformat'):
                return timestamp.isoformat()
            elif hasattr(timestamp, 'seconds'):
                return datetime.fromtimestamp(timestamp.seconds).isoformat()
            else:
                return str(timestamp)
        except:
            return str(timestamp)
    
    def _get_suggestion_reason(self, recipe, score):
        """Generate a human-readable reason for why this recipe was suggested."""
        clauses = []
        is_recent = False

        rating = recipe.get('rating', 0)
        if rating >= 4.5:
            clauses.append('it is highly rated by your friend')
        elif rating >= 4.0:
            clauses.append('it is well rated by your friend')

        recooks = recipe.get('recooks_count', 0)
        if recooks >= 3:
            clauses.append('it is a popular recipe with many re-cooks')

        likes = recipe.get('likes_count', 0)
        if likes >= 5:
            clauses.append('it is liked by many users')

        created_at = recipe.get('created_at')
        if created_at:
            try:
                if hasattr(created_at, 'timestamp'):
                    recipe_date = datetime.fromtimestamp(created_at.timestamp())
                elif hasattr(created_at, 'seconds'):
                    recipe_date = datetime.fromtimestamp(created_at.seconds)
                else:
                    created_str = str(created_at)
                    if 'T' in created_str:
                        recipe_date = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                    else:
                        recipe_date = None

                if recipe_date:
                    if recipe_date.tzinfo:
                        recipe_date = recipe_date.replace(tzinfo=None)
                    days_ago = (datetime.now() - recipe_date).days
                    if days_ago <= 7:
                        is_recent = True
            except Exception:
                pass

        if is_recent and not clauses:
            return 'your friend cooked it recently'
        if is_recent:
            return self._join_reason_clauses(clauses + ['your friend cooked it recently'])
        if clauses:
            return self._join_reason_clauses(clauses)
        return 'your friend cooked it'

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests to get smart suggestions"""
        try:
            # Set CORS headers for cross-origin requests
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            # Check if database is initialized
            if db is None:
                error_response = {
                    'status': 'error',
                    'error': 'Database not initialized. Check Firebase credentials.',
                    'message': 'Failed to generate suggestions'
                }
                self.wfile.write(json.dumps(error_response).encode())
                return
            
            # Get request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                error_response = {
                    'status': 'error',
                    'error': 'Request body is required',
                    'message': 'Failed to generate suggestions'
                }
                self.wfile.write(json.dumps(error_response).encode())
                return
            
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            username = data.get('username')
            limit = data.get('limit', 10)
            
            if not username:
                error_response = {
                    'status': 'error',
                    'error': 'Username is required',
                    'message': 'Failed to generate suggestions'
                }
                self.wfile.write(json.dumps(error_response).encode())
                return
            
            # Generate suggestions
            engine = SmartSuggestionsEngine()
            result = engine.get_suggestions(username, limit)
            
            # Return success response
            response = {
                'status': 'success',
                **result
            }
            self.wfile.write(json.dumps(response).encode())
        
        except json.JSONDecodeError as e:
            # Return error response for JSON decode errors
            error_response = {
                'status': 'error',
                'error': f'Invalid JSON in request body: {str(e)}',
                'message': 'Failed to generate suggestions'
            }
            try:
                self.wfile.write(json.dumps(error_response).encode())
            except:
                pass
        except Exception as e:
            # Return error response
            error_response = {
                'status': 'error',
                'error': str(e),
                'message': 'Failed to generate suggestions'
            }
            try:
                self.wfile.write(json.dumps(error_response).encode())
            except:
                pass  # If we can't write, the connection might be closed
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

