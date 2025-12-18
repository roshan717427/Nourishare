from http.server import BaseHTTPRequestHandler
import json
import os
from collections import Counter
from datetime import datetime

# Import Firebase Admin SDK
from firebase_admin import firestore
import firebase_admin
from firebase_admin import credentials

# Initialize Firebase Admin SDK
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

class SmartSuggestionsEngine:
    """Smart Suggestions Engine for recipe recommendations"""
    
    def __init__(self):
        self.cuisine_keywords = {
            'italian': ['pasta', 'pizza', 'risotto', 'bruschetta', 'tiramisu', 'lasagna', 'ravioli'],
            'asian': ['sushi', 'stir-fry', 'curry', 'dumplings', 'ramen', 'pho', 'teriyaki'],
            'mexican': ['tacos', 'enchiladas', 'guacamole', 'quesadilla', 'churros', 'burrito'],
            'thai': ['pad thai', 'tom yum', 'green curry', 'mango sticky rice', 'thai'],
            'indian': ['curry', 'naan', 'biryani', 'samosa', 'dal', 'tandoori'],
            'french': ['croissant', 'quiche', 'ratatouille', 'coq au vin', 'creme brulee'],
            'mediterranean': ['hummus', 'falafel', 'paella', 'tzatziki', 'baklava'],
            'american': ['burger', 'bbq', 'apple pie', 'mac and cheese', 'chicken wings']
        }
    
    def _get_user_recipes(self, username):
        """Get all recipes cooked by user (from both recipe_posts and logs)"""
        user_recipes = set()
        
        try:
            # Get from recipe_posts
            recipes_ref = db.collection('recipe_posts').where('username', '==', username).stream()
            for recipe in recipes_ref:
                recipe_data = recipe.to_dict()
                recipe_name = recipe_data.get('recipe_name', '').lower().strip()
                if recipe_name:
                    user_recipes.add(recipe_name)
            
            # Get from logs
            logs_ref = db.collection('logs').where('username', '==', username).stream()
            for log in logs_ref:
                log_data = log.to_dict()
                recipe_title = log_data.get('title', '').lower().strip()
                if recipe_title:
                    user_recipes.add(recipe_title)
        
        except Exception as e:
            print(f"Error getting user recipes: {str(e)}")
        
        return user_recipes
    
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
    
    def _detect_cuisine(self, recipe_name, ingredients=None):
        """Detect cuisine type from recipe name and ingredients"""
        recipe_lower = recipe_name.lower()
        detected_cuisines = []
        
        for cuisine, keywords in self.cuisine_keywords.items():
            if any(keyword in recipe_lower for keyword in keywords):
                detected_cuisines.append(cuisine)
        
        # Also check ingredients if provided
        if ingredients:
            ingredients_str = ' '.join(ingredients).lower()
            for cuisine, keywords in self.cuisine_keywords.items():
                if any(keyword in ingredients_str for keyword in keywords):
                    if cuisine not in detected_cuisines:
                        detected_cuisines.append(cuisine)
        
        return detected_cuisines[0] if detected_cuisines else 'general'
    
    def _calculate_suggestion_score(self, recipe, user_recipes, user_preferences=None):
        """Calculate a score for how good this suggestion is (0-100)"""
        score = 0.0
        recipe_name = recipe.get('recipe_name', '').lower().strip()
        
        # Skip if user has already cooked this
        if recipe_name in user_recipes:
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
            recipe_cuisine = self._detect_cuisine(recipe_name, recipe.get('ingredients', []))
            if recipe_cuisine in user_preferences.get('top_cuisines', []):
                score += 10
        
        return score
    
    def get_suggestions(self, username, limit=10):
        """Get smart suggestions for a user"""
        try:
            # Get user's cooking history
            user_recipes = self._get_user_recipes(username)
            
            # Get followed users
            followed_users = self._get_followed_users(username)
            
            if not followed_users:
                return {
                    'suggestions': [],
                    'message': 'Follow some friends to get recipe suggestions!',
                    'total_friends': 0
                }
            
            # Get friends' recipes
            friends_recipes = self._get_friends_recipes(followed_users)
            
            if not friends_recipes:
                return {
                    'suggestions': [],
                    'message': 'Your friends haven\'t cooked any recipes yet!',
                    'total_friends': len(followed_users)
                }
            
            # Get user preferences (from personality if available)
            user_preferences = None
            try:
                user_ref = db.collection('users').document(username).get()
                if user_ref.exists:
                    user_data = user_ref.to_dict()
                    personality = user_data.get('kitchen_personality', {})
                    if personality:
                        user_preferences = {
                            'top_cuisines': personality.get('top_cuisines', [])
                        }
            except:
                pass
            
            # Calculate scores for each recipe
            scored_suggestions = []
            seen_recipes = set()
            
            for recipe in friends_recipes:
                recipe_name = recipe.get('recipe_name', '').lower().strip()
                if not recipe_name or recipe_name in seen_recipes:
                    continue
                
                seen_recipes.add(recipe_name)
                score = self._calculate_suggestion_score(recipe, user_recipes, user_preferences)
                
                if score > 0:  # Only include recipes with positive scores
                    # Format suggestion
                    suggestion = {
                        'recipe_name': recipe.get('recipe_name', ''),
                        'recipe_id': recipe.get('id', ''),
                        'username': recipe.get('username', ''),
                        'rating': recipe.get('rating', 0),
                        'cooking_notes': recipe.get('cooking_notes', ''),
                        'difficulty_level': recipe.get('difficulty_level', 'medium'),
                        'cooking_time': recipe.get('cooking_time', ''),
                        'recooks_count': recipe.get('recooks_count', 0),
                        'likes_count': recipe.get('likes_count', 0),
                        'created_at': self._format_timestamp(recipe.get('created_at')),
                        'suggestion_score': round(score, 2),
                        'why_suggested': self._get_suggestion_reason(recipe, score)
                    }
                    scored_suggestions.append(suggestion)
            
            # Sort by score (highest first)
            scored_suggestions.sort(key=lambda x: x['suggestion_score'], reverse=True)
            
            # Return top suggestions
            return {
                'suggestions': scored_suggestions[:limit],
                'total_suggestions': len(scored_suggestions),
                'total_friends': len(followed_users),
                'message': f'Found {len(scored_suggestions)} recipe suggestions based on what your friends are cooking!'
            }
        
        except Exception as e:
            print(f"Error generating suggestions: {str(e)}")
            return {
                'suggestions': [],
                'error': str(e),
                'message': 'Error generating suggestions'
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
        """Generate a human-readable reason for why this recipe was suggested"""
        reasons = []
        
        rating = recipe.get('rating', 0)
        if rating >= 4.5:
            reasons.append('highly rated by your friend')
        elif rating >= 4.0:
            reasons.append('well-rated by your friend')
        
        recooks = recipe.get('recooks_count', 0)
        if recooks >= 3:
            reasons.append('popular recipe (many re-cooks)')
        
        likes = recipe.get('likes_count', 0)
        if likes >= 5:
            reasons.append('liked by many users')
        
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
                        reasons.append('recently cooked')
            except:
                pass
        
        if reasons:
            return ', '.join(reasons)
        return 'cooked by your friend'

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
            
            # Get request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                response = {
                    'error': 'Request body is required',
                    'status': 'error'
                }
                self.wfile.write(json.dumps(response).encode())
                return
            
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            username = data.get('username')
            limit = data.get('limit', 10)
            
            if not username:
                response = {
                    'error': 'Username is required',
                    'status': 'error'
                }
                self.wfile.write(json.dumps(response).encode())
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

