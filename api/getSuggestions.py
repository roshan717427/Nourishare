from http.server import BaseHTTPRequestHandler
import importlib.util
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime

_suggestion_images_path = os.path.join(os.path.dirname(__file__), 'suggestion_images.py')
_spec = importlib.util.spec_from_file_location('suggestion_images', _suggestion_images_path)
_suggestion_images = importlib.util.module_from_spec(_spec)
sys.modules['suggestion_images'] = _suggestion_images
_spec.loader.exec_module(_suggestion_images)
DEFAULT_FALLBACK_IMAGE = _suggestion_images.DEFAULT_FALLBACK_IMAGE
title_matched_image = _suggestion_images.title_matched_image

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
        {'name': 'Quick Herb Chicken Skillet', 'ingredients': 'chicken, onion, garlic, herbs, lemon', 'cooking_time': '25 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80'},
    ],
}

INGREDIENT_IDEAS = {
    'chicken': {'name': 'Lemon Herb Roast Chicken', 'ingredients': 'chicken, lemon, garlic, rosemary, olive oil', 'cooking_time': '45 min', 'difficulty_level': 'medium', 'image': 'https://images.unsplash.com/photo-1768238907887-023b7ac9f450?w=500&q=80'},
    'pasta': {'name': 'Weeknight Tomato Pasta', 'ingredients': 'pasta, tomatoes, garlic, basil, olive oil', 'cooking_time': '20 min', 'difficulty_level': 'easy', 'image': 'https://images.unsplash.com/photo-1695742434600-e0f59629d2bb?w=500&q=80'},
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

    def _token_matches_pantry(self, recipe_token, pantry_tokens):
        """Fuzzy match: lowercase trim, substring or token match."""
        if not recipe_token or not pantry_tokens:
            return False
        for pantry in pantry_tokens:
            if pantry in recipe_token or recipe_token in pantry:
                return True
        return False

    def _split_by_pantry(self, recipe_ingredients, pantry_tokens):
        """Split recipe ingredients into have vs need lists based on pantry."""
        recipe_tokens = self._normalize_ingredients(recipe_ingredients)
        if not pantry_tokens:
            return [], recipe_tokens
        have = []
        need = []
        for token in recipe_tokens:
            if self._token_matches_pantry(token, pantry_tokens):
                have.append(token)
            else:
                need.append(token)
        return have, need

    def _pantry_boost_score(self, recipe_tokens, pantry_tokens):
        """Score boost 0-50 when pantry overlaps with recipe ingredients."""
        if not pantry_tokens or not recipe_tokens:
            return 0.0
        overlap = sum(
            1 for token in recipe_tokens if self._token_matches_pantry(token, pantry_tokens)
        )
        ratio = overlap / max(len(recipe_tokens), 1)
        return min(50.0, ratio * 50 + overlap * 5)

    def _apply_pantry(self, suggestions, pantry_ingredients):
        """Rank by pantry overlap and attach ingredients_have / ingredients_need."""
        pantry_tokens = self._normalize_ingredients(pantry_ingredients)
        if not pantry_tokens:
            return suggestions
        for suggestion in suggestions:
            recipe_tokens = self._normalize_ingredients(suggestion.get('ingredients'))
            have, need = self._split_by_pantry(suggestion.get('ingredients'), pantry_tokens)
            suggestion['ingredients_have'] = have
            suggestion['ingredients_need'] = need
            boost = self._pantry_boost_score(recipe_tokens, pantry_tokens)
            suggestion['suggestion_score'] = round(
                float(suggestion.get('suggestion_score', 0)) + boost, 2
            )
        suggestions.sort(key=lambda item: item.get('suggestion_score', 0), reverse=True)
        return suggestions

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
        """Get meals from friends (followed users), including logs and recipe posts."""
        friends_recipes = []

        try:
            if not followed_users:
                return friends_recipes

            collections = ['recipe_posts', 'logs']
            for collection_name in collections:
                for i in range(0, len(followed_users), 10):
                    batch = followed_users[i:i + 10]
                    recipes_ref = (
                        db.collection(collection_name)
                        .where('username', 'in', batch)
                        .stream()
                    )

                    for recipe in recipes_ref:
                        recipe_data = recipe.to_dict() or {}
                        recipe_data['id'] = recipe.id
                        if collection_name == 'logs':
                            recipe_data['recipe_name'] = (
                                recipe_data.get('recipe_name')
                                or recipe_data.get('title')
                                or ''
                            )
                            recipe_data['cooking_time'] = (
                                recipe_data.get('cooking_time')
                                or recipe_data.get('time')
                                or ''
                            )
                            recipe_data['difficulty_level'] = (
                                recipe_data.get('difficulty_level')
                                or recipe_data.get('difficulty')
                                or 'medium'
                            )
                            recipe_data['image'] = (
                                recipe_data.get('image')
                                or recipe_data.get('photoUrl')
                                or recipe_data.get('photo_url')
                            )
                            recipe_data['created_at'] = (
                                recipe_data.get('created_at')
                                or recipe_data.get('createdAt')
                            )
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

    def _is_valid_https_url(self, url):
        """True when url is a non-empty HTTPS string suitable for clients."""
        if not isinstance(url, str):
            return False
        cleaned = url.strip()
        if not cleaned.lower().startswith('https://'):
            return False
        return len(cleaned) > 12

    def _normalize_https_url(self, url):
        """Strip and upgrade http:// to https:// when present."""
        if not isinstance(url, str):
            return ''
        cleaned = url.strip()
        if cleaned.lower().startswith('http://'):
            cleaned = 'https://' + cleaned[7:]
        return cleaned

    def _title_matched_image(self, recipe_name):
        """Canonical suggestion image: always derived from the dish title."""
        return title_matched_image(recipe_name)

    def _recipe_image(self, recipe, blocked_urls=None):
        """Use title-matched stock photos — never trust incoming community/friend image URLs."""
        recipe_name = (
            recipe.get('recipe_name')
            or recipe.get('name')
            or recipe.get('title')
            or ''
        )
        return self._title_matched_image(recipe_name)

    def _ensure_suggestion_images(self, suggestions):
        """Guarantee every suggestion has a title-matched HTTPS image URL."""
        finalized = []
        for suggestion in suggestions or []:
            name = (
                suggestion.get('recipe_name')
                or suggestion.get('name')
                or 'Recipe'
            )
            suggestion['image'] = self._title_matched_image(name)
            finalized.append(suggestion)
        return finalized

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
            'image': self._recipe_image(recipe, blocked_urls) or DEFAULT_FALLBACK_IMAGE,
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

    def _format_friend_name(self, username):
        """Readable friend label for suggestion copy."""
        if not username:
            return 'your friend'
        cleaned = str(username).strip()
        if not cleaned:
            return 'your friend'
        if ' ' in cleaned:
            return cleaned.split()[0]
        return cleaned[0].upper() + cleaned[1:]

    def _friend_recency_score(self, created_at):
        """Recency weight for friend inspiration meals (0-20)."""
        if not created_at:
            return 5.0
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
                    return 5.0
            if recipe_date.tzinfo:
                recipe_date = recipe_date.replace(tzinfo=None)
            days_ago = (datetime.now() - recipe_date).days
            if days_ago <= 7:
                return 20.0
            if days_ago <= 30:
                return 15.0
            if days_ago <= 90:
                return 10.0
        except Exception:
            pass
        return 5.0

    def _build_friend_inspiration_entries(self, friends_recipes):
        """Turn friend logs/posts into inspiration signals (not direct suggestions)."""
        entries = []
        seen = set()

        for recipe in friends_recipes:
            title = (recipe.get('recipe_name') or recipe.get('title') or '').strip()
            if not title:
                continue

            friend_user = (recipe.get('username') or '').strip()
            normalized = self._normalize_title(title)
            dedupe_key = (friend_user, normalized)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            ingredients = self._normalize_ingredients(recipe.get('ingredients'))
            cuisines = self._detect_cuisines(title.lower(), ingredients)
            photo = None
            for field in ('image', 'photoUrl', 'photo_url'):
                url = recipe.get(field)
                if url:
                    photo = url
                    break

            entries.append({
                'friend_username': friend_user,
                'friend_name': self._format_friend_name(friend_user),
                'title': title,
                'normalized_title': normalized,
                'recipe_id': str(recipe.get('id') or recipe.get('recipe_id') or ''),
                'ingredients': ingredients,
                'cuisines': cuisines,
                'cuisine': cuisines[0] if cuisines else 'general',
                'difficulty': str(
                    recipe.get('difficulty_level') or recipe.get('difficulty') or 'medium'
                ).lower(),
                'cooking_time': recipe.get('cooking_time') or recipe.get('time') or '',
                'photo': photo,
                'rating': recipe.get('rating', 0) or 0,
                'recency_score': self._friend_recency_score(
                    recipe.get('created_at') or recipe.get('createdAt')
                ),
            })

        entries.sort(
            key=lambda entry: (entry['recency_score'], entry['rating']),
            reverse=True,
        )
        return entries

    def _is_friend_exact_match(self, name, ingredients, recipe_id, inspiration_entry):
        """True when a candidate is the same dish a friend logged or posted."""
        if self._normalize_title(name) == inspiration_entry.get('normalized_title'):
            return True
        if self._titles_similar(name, inspiration_entry.get('title', '')):
            return True
        candidate_id = str(recipe_id or '').strip()
        friend_id = inspiration_entry.get('recipe_id', '')
        if candidate_id and friend_id and candidate_id == friend_id:
            return True
        return False

    def _is_any_friend_exact_match(self, name, ingredients, recipe_id, inspiration_entries):
        for entry in inspiration_entries:
            if self._is_friend_exact_match(name, ingredients, recipe_id, entry):
                return True
        return False

    def _variant_similarity_score(self, variant, inspiration_entry):
        """Score 0-100 for how closely a variant echoes a friend's meal."""
        score = 0.0
        variant_name = (
            variant.get('recipe_name') or variant.get('name') or variant.get('title') or ''
        )
        variant_tokens = self._normalize_ingredients(variant.get('ingredients'))
        inspiration_tokens = inspiration_entry.get('ingredients', [])

        variant_cuisines = self._detect_cuisines(variant_name.lower(), variant_tokens)
        inspiration_cuisines = inspiration_entry.get('cuisines', ['general'])
        if any(cuisine in variant_cuisines for cuisine in inspiration_cuisines):
            score += 35
        elif inspiration_entry.get('cuisine', 'general') in variant_cuisines:
            score += 25

        if variant_tokens and inspiration_tokens:
            overlap_ratio = self._ingredient_overlap_ratio(variant_tokens, inspiration_tokens)
            shared = len(set(variant_tokens) & set(inspiration_tokens))
            score += min(40.0, overlap_ratio * 40 + shared * 5)

        variant_difficulty = str(
            variant.get('difficulty_level') or variant.get('difficulty') or ''
        ).lower()
        if variant_difficulty and variant_difficulty == inspiration_entry.get('difficulty'):
            score += 10

        variant_time = str(
            variant.get('cooking_time') or variant.get('time') or ''
        ).lower()
        inspiration_time = str(inspiration_entry.get('cooking_time') or '').lower()
        if variant_time and inspiration_time and variant_time == inspiration_time:
            score += 5

        score += inspiration_entry.get('recency_score', 0) * 0.25
        return score

    def _friend_variant_reason(self, inspiration_entry, variant_dict):
        """Explain similarity to a friend's meal without implying they cooked this dish."""
        friend_name = inspiration_entry.get('friend_name') or 'your friend'
        is_recent = inspiration_entry.get('recency_score', 0) >= 15
        recency_phrase = (
            f'a meal {friend_name} cooked recently'
            if is_recent
            else f'what {friend_name} made'
        )

        variant_name = (
            variant_dict.get('recipe_name')
            or variant_dict.get('name')
            or variant_dict.get('title')
            or ''
        )
        variant_tokens = self._normalize_ingredients(variant_dict.get('ingredients'))
        inspiration_tokens = inspiration_entry.get('ingredients', [])
        variant_cuisines = self._detect_cuisines(variant_name.lower(), variant_tokens)
        inspiration_cuisine = inspiration_entry.get('cuisine', 'general')
        cuisine_label = self._display_cuisine(inspiration_cuisine)

        clauses = []
        if (
            cuisine_label
            and inspiration_cuisine != 'general'
            and inspiration_cuisine in variant_cuisines
        ):
            clauses.append(
                f'it is in the same {cuisine_label} style as {recency_phrase}'
            )

        if variant_tokens and inspiration_tokens:
            shared = set(variant_tokens) & set(inspiration_tokens)
            overlap_ratio = self._ingredient_overlap_ratio(variant_tokens, inspiration_tokens)
            if len(shared) >= 2:
                clauses.append(
                    f'it shares ingredients with a dish {friend_name} cooked'
                )
            elif overlap_ratio >= 0.25:
                clauses.append(
                    f'it uses similar ingredients to {recency_phrase}'
                )

        if not clauses:
            return f'it is similar to {recency_phrase}'
        return self._join_reason_clauses(clauses[:2])

    def _template_variants_for_inspiration(
        self, inspiration_entry, tried_profile, seen_names, inspiration_entries
    ):
        """Curated variant ideas aligned with a friend's meal."""
        variants = []
        cuisine = inspiration_entry.get('cuisine', 'general')
        template_lists = []
        if cuisine in CUISINE_TEMPLATES:
            template_lists.append(CUISINE_TEMPLATES[cuisine])
        template_lists.append(CUISINE_TEMPLATES['general'])

        slug_base = re.sub(
            r'[^\w-]',
            '',
            inspiration_entry.get('friend_username', 'friend').lower(),
        )

        for templates in template_lists:
            for template in templates:
                name = template['name']
                normalized = self._normalize_title(name)
                if normalized in seen_names:
                    continue
                if self._is_any_friend_exact_match(
                    name, template.get('ingredients'), '', inspiration_entries
                ):
                    continue
                if self._is_already_tried(
                    name, template.get('ingredients'), '', tried_profile
                ):
                    continue

                variant = {
                    'id': f'friend-variant-{slug_base}-{normalized.replace(" ", "-")}',
                    'recipe_name': name,
                    'ingredients': template['ingredients'],
                    'cooking_time': template.get('cooking_time', ''),
                    'difficulty_level': template.get('difficulty_level', 'medium'),
                    'image': template.get('image'),
                    'username': inspiration_entry.get('friend_username', ''),
                }
                score = self._variant_similarity_score(variant, inspiration_entry)
                if score >= 20:
                    variants.append((variant, score))

        for token in inspiration_entry.get('ingredients', [])[:6]:
            for key, idea in INGREDIENT_IDEAS.items():
                if key not in token:
                    continue
                name = idea['name']
                normalized = self._normalize_title(name)
                if normalized in seen_names:
                    continue
                if self._is_any_friend_exact_match(
                    name, idea.get('ingredients'), '', inspiration_entries
                ):
                    continue
                if self._is_already_tried(
                    name, idea.get('ingredients'), '', tried_profile
                ):
                    continue
                variant = {
                    'id': f'friend-variant-{slug_base}-ingredient-{key}',
                    'recipe_name': name,
                    'ingredients': idea['ingredients'],
                    'cooking_time': idea.get('cooking_time', ''),
                    'difficulty_level': idea.get('difficulty_level', 'medium'),
                    'image': idea.get('image'),
                    'username': inspiration_entry.get('friend_username', ''),
                }
                score = self._variant_similarity_score(variant, inspiration_entry)
                if score >= 20:
                    variants.append((variant, score))
                break

        variants.sort(key=lambda item: item[1], reverse=True)
        return variants

    def _load_community_variants_for_friends(
        self, username, inspiration_entries, tried_profile
    ):
        """Community recipes that echo friend meals without repeating exact dishes."""
        candidates = []
        try:
            recipes_ref = db.collection('recipe_posts').limit(300).stream()
            for recipe in recipes_ref:
                recipe_data = recipe.to_dict() or {}
                recipe_data['id'] = recipe.id
                recipe_name = (recipe_data.get('recipe_name') or '').strip()
                if not recipe_name:
                    continue
                if recipe_data.get('username', '') == username:
                    continue
                if self._is_any_friend_exact_match(
                    recipe_name,
                    recipe_data.get('ingredients'),
                    recipe_data.get('id'),
                    inspiration_entries,
                ):
                    continue
                if self._is_already_tried(
                    recipe_name,
                    recipe_data.get('ingredients'),
                    recipe_data.get('id'),
                    tried_profile,
                ):
                    continue
                candidates.append(recipe_data)
        except Exception as e:
            print(f"Error loading community variants for friends: {str(e)}")
        return candidates

    def _pick_variant_for_inspiration(
        self,
        inspiration_entry,
        inspiration_entries,
        community_candidates,
        tried_profile,
        seen_names,
    ):
        """Best similar alternative for one friend meal inspiration signal."""
        best_variant = None
        best_score = 0.0

        for recipe_data in community_candidates:
            recipe_name = (recipe_data.get('recipe_name') or '').strip()
            normalized = self._normalize_title(recipe_name)
            if normalized in seen_names:
                continue
            if self._is_friend_exact_match(
                recipe_name,
                recipe_data.get('ingredients'),
                recipe_data.get('id'),
                inspiration_entry,
            ):
                continue
            similarity = self._variant_similarity_score(recipe_data, inspiration_entry)
            if similarity > best_score:
                best_score = similarity
                best_variant = recipe_data

        if best_score < 35:
            for variant_dict, similarity in self._template_variants_for_inspiration(
                inspiration_entry, tried_profile, seen_names, inspiration_entries
            ):
                if similarity > best_score:
                    best_score = similarity
                    best_variant = variant_dict

        if not best_variant or best_score < 25:
            return None, 0.0, ''

        reason = self._friend_variant_reason(inspiration_entry, best_variant)
        return best_variant, best_score, reason

    def _get_friend_suggestions(self, username, tried_profile, log_profile, followed_users, limit=6):
        """Suggest variant recipes inspired by friends' meals — not their exact dishes."""
        if not followed_users:
            return []

        friends_recipes = self._get_friends_recipes(followed_users)
        inspiration_entries = self._build_friend_inspiration_entries(friends_recipes)
        if not inspiration_entries:
            return []

        friend_photos = {entry['photo'] for entry in inspiration_entries if entry.get('photo')}
        blocked_urls = tried_profile.get('log_photos', set()) | friend_photos
        community_candidates = self._load_community_variants_for_friends(
            username, inspiration_entries, tried_profile
        )

        suggestions = []
        seen_names = set()

        for inspiration_entry in inspiration_entries:
            if len(suggestions) >= limit:
                break

            variant, score, reason = self._pick_variant_for_inspiration(
                inspiration_entry,
                inspiration_entries,
                community_candidates,
                tried_profile,
                seen_names,
            )
            if not variant:
                continue

            normalized = self._normalize_title(
                variant.get('recipe_name') or variant.get('name') or ''
            )
            if not normalized or normalized in seen_names:
                continue
            seen_names.add(normalized)

            suggestions.append(
                self._format_suggestion(variant, score, reason, blocked_urls)
            )

        if len(suggestions) < max(3, min(limit, 3)):
            for inspiration_entry in inspiration_entries:
                if len(suggestions) >= limit:
                    break
                for variant_dict, similarity in self._template_variants_for_inspiration(
                    inspiration_entry, tried_profile, seen_names, inspiration_entries
                ):
                    normalized = self._normalize_title(variant_dict.get('recipe_name', ''))
                    if not normalized or normalized in seen_names:
                        continue
                    seen_names.add(normalized)
                    reason = self._friend_variant_reason(inspiration_entry, variant_dict)
                    suggestions.append(
                        self._format_suggestion(
                            variant_dict, similarity, reason, blocked_urls
                        )
                    )
                    break

        suggestions.sort(key=lambda item: item['suggestion_score'], reverse=True)
        return suggestions[:limit]

    def get_suggestions(self, username, limit=10, pantry_ingredients=None):
        """Get smart suggestions for a user (preferences + friends)."""
        try:
            logs = self._get_user_logs(username)
            has_logs = len(logs) >= 1
            log_profile = self._build_log_profile(logs) if logs else {}
            tried_profile = self._build_tried_profile(username, logs)
            followed_users = self._get_followed_users(username)
            has_friends = len(followed_users) >= 1

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

            preference_suggestions = self._ensure_suggestion_images(
                preference_suggestions
            )
            friend_suggestions = self._ensure_suggestion_images(friend_suggestions)

            if pantry_ingredients:
                preference_suggestions = self._apply_pantry(
                    preference_suggestions, pantry_ingredients
                )
                friend_suggestions = self._apply_pantry(
                    friend_suggestions, pantry_ingredients
                )

            return {
                'preference_suggestions': preference_suggestions,
                'friend_suggestions': friend_suggestions,
                # Backward-compatible alias for older clients.
                'suggestions': friend_suggestions,
                'has_logs': has_logs,
                'has_friends': has_friends,
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
                'has_friends': False,
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
            pantry_ingredients = data.get('pantry_ingredients')
            if pantry_ingredients is not None and not isinstance(pantry_ingredients, list):
                pantry_ingredients = None
            
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
            result = engine.get_suggestions(username, limit, pantry_ingredients)
            
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

