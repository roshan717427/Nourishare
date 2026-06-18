from http.server import BaseHTTPRequestHandler
import json
import sys
import os
from collections import Counter

from validate_input import normalize_username

# Add the functions directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'functions'))

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

class LightweightKitchenAnalyzer:
    """Lightweight version of Kitchen Personality Analyzer for Vercel"""
    
    def __init__(self):
        self.cuisine_categories = {
            'italian': ['pasta', 'pizza', 'risotto', 'bruschetta', 'tiramisu'],
            'asian': ['sushi', 'stir-fry', 'curry', 'dumplings', 'ramen'],
            'mexican': ['tacos', 'enchiladas', 'guacamole', 'quesadilla', 'churros'],
            'thai': ['pad thai', 'tom yum', 'green curry', 'mango sticky rice'],
            'indian': ['curry', 'naan', 'biryani', 'samosa', 'dal'],
            'french': ['croissant', 'quiche', 'ratatouille', 'coq au vin', 'creme brulee'],
            'mediterranean': ['hummus', 'falafel', 'paella', 'tzatziki', 'baklava'],
            'american': ['burger', 'bbq', 'apple pie', 'mac and cheese', 'chicken wings']
        }
        
        self.difficulty_weights = {'easy': 1, 'medium': 2, 'hard': 3}
        self.rating_weights = {1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1.0}
    
    def _get_user_recipes(self, user_id):
        """Get all recipes for a user"""
        try:
            # Try to get from recipe_posts collection first
            recipes_ref = db.collection('recipe_posts').where('username', '==', user_id).stream()
            recipes = []
            
            for recipe in recipes_ref:
                recipe_data = recipe.to_dict()
                mapped_recipe = {
                    'title': recipe_data.get('recipe_name', ''),
                    'cuisines': recipe_data.get('cuisines', []),
                    'ingredients': recipe_data.get('ingredients', []),
                    'rating': recipe_data.get('rating', 0),
                    'difficulty': recipe_data.get('difficulty_level', 'medium'),
                    'cooking_time': recipe_data.get('cooking_time', 30),
                    'created_at': recipe_data.get('created_at'),
                    'source': recipe_data.get('source', ''),
                    'notes': recipe_data.get('cooking_notes', '')
                }
                recipes.append(mapped_recipe)
            
            # If no recipes in recipe_posts, try logs collection
            if not recipes:
                logs_ref = db.collection('logs').where('username', '==', user_id).stream()
                for log in logs_ref:
                    log_data = log.to_dict()
                    mapped_recipe = {
                        'title': log_data.get('title', ''),
                        'cuisines': self._detect_cuisines_from_title(log_data.get('title', '')),
                        'ingredients': log_data.get('ingredients', []),
                        'rating': log_data.get('rating', 0),
                        'difficulty': log_data.get('difficulty', 'medium'),
                        'cooking_time': log_data.get('time', 30),
                        'created_at': log_data.get('createdAt'),
                        'source': log_data.get('source', ''),
                        'notes': log_data.get('notes', '')
                    }
                    recipes.append(mapped_recipe)
            
            return recipes
            
        except Exception as e:
            print(f"Error getting user recipes: {str(e)}")
            return []
    
    def _detect_cuisines_from_title(self, title):
        """Detect cuisines from recipe title using keyword matching"""
        detected_cuisines = []
        title_lower = title.lower()
        
        for cuisine, keywords in self.cuisine_categories.items():
            for keyword in keywords:
                if keyword in title_lower:
                    detected_cuisines.append(cuisine)
                    break
        
        return detected_cuisines
    
    def _analyze_cuisine_preferences(self, recipes):
        """Analyze user's cuisine preferences"""
        cuisine_counts = Counter()
        all_cuisines = []
        
        for recipe in recipes:
            cuisines = recipe.get('cuisines', [])
            all_cuisines.extend(cuisines)
            for cuisine in cuisines:
                cuisine_counts[cuisine] += 1
        
        unique_cuisines = len(set(all_cuisines))
        total_recipes = len(recipes)
        diversity_score = min(1.0, unique_cuisines / max(total_recipes, 1))
        
        return {
            'cuisine_counts': cuisine_counts,
            'top_cuisines': cuisine_counts.most_common(5),
            'diversity_score': diversity_score,
            'total_cuisines': unique_cuisines
        }
    
    def _analyze_cooking_style(self, recipes):
        """Analyze user's cooking style preferences"""
        difficulties = []
        ratings = []
        
        for recipe in recipes:
            difficulty = recipe.get('difficulty', 'medium')
            rating = recipe.get('rating', 0)
            
            if difficulty in self.difficulty_weights:
                difficulties.append(self.difficulty_weights[difficulty])
            if rating > 0:
                ratings.append(rating)
        
        avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 2.0
        avg_rating = sum(ratings) / len(ratings) if ratings else 3.0
        
        if avg_difficulty > 2.5:
            style = 'adventurous'
        elif avg_difficulty < 1.5:
            style = 'comfort-focused'
        else:
            style = 'balanced'
        
        return {
            'avg_difficulty': avg_difficulty,
            'avg_rating': avg_rating,
            'style_preference': style
        }
    
    def _analyze_ingredient_preferences(self, recipes):
        """Analyze user's ingredient preferences"""
        ingredient_counts = Counter()
        
        for recipe in recipes:
            ingredients = recipe.get('ingredients', [])
            ingredient_counts.update(ingredients)
        
        return {
            'ingredient_counts': ingredient_counts,
            'top_ingredients': ingredient_counts.most_common(10),
            'total_unique_ingredients': len(ingredient_counts)
        }
    
    def _analyze_cooking_patterns(self, recipes):
        """Analyze user's cooking patterns and frequency"""
        if not recipes:
            return {
                'frequency_category': 'new_cook',
                'avg_rating': 0,
                'avg_cooking_time': 0,
                'total_recipes': 0
            }
        
        cooking_times = [r.get('cooking_time', 30) for r in recipes if r.get('cooking_time')]
        ratings = [r.get('rating', 0) for r in recipes if r.get('rating', 0) > 0]
        
        avg_cooking_time = sum(cooking_times) / len(cooking_times) if cooking_times else 30
        avg_rating = sum(ratings) / len(ratings) if ratings else 3.0
        
        if len(recipes) >= 10:
            frequency = 'experienced_cook'
        elif len(recipes) >= 5:
            frequency = 'regular_cook'
        elif len(recipes) >= 2:
            frequency = 'occasional_cook'
        else:
            frequency = 'new_cook'
        
        return {
            'frequency_category': frequency,
            'avg_rating': avg_rating,
            'avg_cooking_time': avg_cooking_time,
            'total_recipes': len(recipes)
        }
    
    def _determine_primary_trait(self, cuisine_analysis, cooking_style, cooking_patterns):
        """Determine primary personality trait"""
        if cuisine_analysis['diversity_score'] > 0.7:
            return 'Global Explorer'
        elif cooking_style['style_preference'] == 'adventurous':
            return 'Adventurous Chef'
        elif cooking_style['avg_rating'] > 4.5:
            return 'Quality Focused'
        elif cooking_patterns['total_recipes'] > 20:
            return 'Experienced Cook'
        else:
            return 'Kitchen Enthusiast'
    
    def _determine_secondary_traits(self, cuisine_analysis, cooking_style, ingredient_preferences):
        """Determine secondary personality traits"""
        traits = []
        
        if cuisine_analysis['diversity_score'] > 0.5:
            traits.append('Cuisine Explorer')
        if cooking_style['style_preference'] == 'balanced':
            traits.append('Balanced Cook')
        if len(ingredient_preferences['top_ingredients']) > 5:
            traits.append('Ingredient Adventurer')
        
        return traits[:2]  # Return max 2 secondary traits
    
    def _calculate_experimental_score(self, cuisine_analysis, cooking_style):
        """Calculate experimental score (0-1)"""
        cuisine_diversity = cuisine_analysis['diversity_score']
        difficulty_factor = (cooking_style['avg_difficulty'] - 1) / 2  # Normalize 1-3 to 0-1
        
        experimental_score = (cuisine_diversity * 0.6) + (difficulty_factor * 0.4)
        return min(1.0, max(0.0, experimental_score))
    
    def _calculate_comfort_score(self, cooking_patterns, cuisine_analysis):
        """Calculate comfort score (0-1)"""
        recipe_count = cooking_patterns['total_recipes']
        cuisine_familiarity = 1.0 - cuisine_analysis['diversity_score']  # Lower diversity = higher comfort
        
        if recipe_count >= 10:
            experience_factor = 0.8
        elif recipe_count >= 5:
            experience_factor = 0.6
        elif recipe_count >= 2:
            experience_factor = 0.4
        else:
            experience_factor = 0.2
        
        comfort_score = (experience_factor * 0.7) + (cuisine_familiarity * 0.3)
        return min(1.0, max(0.0, comfort_score))
    
    def _determine_skill_level(self, cooking_style, cooking_patterns):
        """Determine skill level"""
        if cooking_patterns['total_recipes'] >= 20:
            return 'advanced'
        elif cooking_patterns['total_recipes'] >= 10:
            return 'intermediate'
        elif cooking_patterns['total_recipes'] >= 3:
            return 'beginner'
        else:
            return 'newcomer'
    
    def _get_default_personality(self):
        """Return default personality for new users"""
        return {
            'primary_trait': 'Kitchen Newcomer',
            'secondary_traits': ['Learning Chef', 'Curious Cook'],
            'top_cuisines': [],
            'favorite_ingredients': [],
            'cooking_frequency': 'new_cook',
            'experimental_score': 0.0,
            'comfort_score': 0.0,
            'cuisine_diversity': 0.0,
            'skill_level': 'newcomer',
            'cooking_stats': {
                'total_recipes': 0,
                'avg_rating': 0,
                'avg_difficulty': 2.0,
                'avg_cooking_time': 30,
                'unique_cuisines': 0,
                'unique_ingredients': 0
            },
            'last_updated': '2025-08-12T00:00:00'
        }
    
    def analyze_user_personality(self, user_id):
        """Main function to analyze user's kitchen personality"""
        try:
            recipes = self._get_user_recipes(user_id)
            
            if not recipes:
                return self._get_default_personality()
            
            cuisine_analysis = self._analyze_cuisine_preferences(recipes)
            cooking_style = self._analyze_cooking_style(recipes)
            ingredient_preferences = self._analyze_ingredient_preferences(recipes)
            cooking_patterns = self._analyze_cooking_patterns(recipes)
            
            primary_trait = self._determine_primary_trait(cuisine_analysis, cooking_style, cooking_patterns)
            secondary_traits = self._determine_secondary_traits(cuisine_analysis, cooking_style, ingredient_preferences)
            
            experimental_score = self._calculate_experimental_score(cuisine_analysis, cooking_style)
            comfort_score = self._calculate_comfort_score(cooking_patterns, cuisine_analysis)
            skill_level = self._determine_skill_level(cooking_style, cooking_patterns)
            
            personality = {
                'primary_trait': primary_trait,
                'secondary_traits': secondary_traits,
                'top_cuisines': [cuisine for cuisine, _ in cuisine_analysis['top_cuisines'][:3]],
                'favorite_ingredients': [ingredient for ingredient, _ in ingredient_preferences['top_ingredients'][:5]],
                'cooking_frequency': cooking_patterns['frequency_category'],
                'experimental_score': round(experimental_score, 2),
                'comfort_score': round(comfort_score, 2),
                'cuisine_diversity': round(cuisine_analysis['diversity_score'], 2),
                'skill_level': skill_level,
                'cooking_stats': {
                    'total_recipes': len(recipes),
                    'avg_rating': round(cooking_patterns['avg_rating'], 2),
                    'avg_difficulty': round(cooking_style['avg_difficulty'], 2),
                    'avg_cooking_time': round(cooking_patterns['avg_cooking_time'], 2),
                    'unique_cuisines': len(cuisine_analysis['cuisine_counts']),
                    'unique_ingredients': len(ingredient_preferences['ingredient_counts'])
                },
                'last_updated': '2025-08-12T00:00:00'
            }
            
            return personality
            
        except Exception as e:
            print(f"Error analyzing personality: {str(e)}")
            return self._get_default_personality()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests to analyze kitchen personality"""
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
                    'message': 'Failed to analyze kitchen personality'
                }
                self.wfile.write(json.dumps(error_response).encode())
                return
            
            # Get request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                error_response = {
                    'status': 'error',
                    'error': 'Request body is required',
                    'message': 'Failed to analyze kitchen personality'
                }
                self.wfile.write(json.dumps(error_response).encode())
                return
                
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            user_id = normalize_username(request_data.get('user_id'))
            if not user_id:
                response = {
                    'status': 'error',
                    'error': 'User ID is required',
                    'message': 'Failed to analyze kitchen personality'
                }
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Create analyzer instance
            analyzer = LightweightKitchenAnalyzer()
            
            # Analyze user personality
            personality = analyzer.analyze_user_personality(user_id)
            
            # Return success response
            response = {
                'status': 'success',
                'personality': personality,
                'message': 'Kitchen personality analyzed successfully'
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except json.JSONDecodeError as e:
            # Return error response for JSON decode errors
            error_response = {
                'status': 'error',
                'error': f'Invalid JSON in request body: {str(e)}',
                'message': 'Failed to analyze kitchen personality'
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
                'message': 'Failed to analyze kitchen personality'
            }
            try:
                self.wfile.write(json.dumps(error_response).encode())
            except:
                pass
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
