# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn, firestore_fn
from firebase_admin import firestore
import firebase_admin
from firebase_admin import credentials
import uuid
from datetime import datetime
import json
import os

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    if 'GOOGLE_APPLICATION_CREDENTIALS_JSON' in os.environ:
        cred_dict = json.loads(os.environ['GOOGLE_APPLICATION_CREDENTIALS_JSON'])
        cred = credentials.Certificate(cred_dict)
    else:
        cred = credentials.Certificate('../serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Helper function to create activity
def create_activity(actor_username, activity_type, target_id, target_type):
    activity_id = str(uuid.uuid4())
    activity_data = {
        'id': activity_id,
        'actor_username': actor_username,
        'activity_type': activity_type,
        'target_id': target_id,
        'target_type': target_type,
        'timestamp': firestore.SERVER_TIMESTAMP
    }
    
    db.collection('activities').document(activity_id).set(activity_data)
    db.collection('users').document(actor_username).collection('activities').document(activity_id).set(activity_data)
    
    return activity_id

# Create a new user profile
@https_fn.on_request()
def create_user(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        data = req.get_json()
        username = data.get('username')
        if not username:
            return https_fn.Response('Username is required', status=400)
        
        user_ref = db.collection('users').document(username)
        data['followers_count'] = 0
        data['following_count'] = 0
        user_ref.set(data)
        
        return https_fn.Response(json.dumps({'message': 'User created', 'username': username}), status=201)
    except Exception as e:
        return https_fn.Response(f'Error: {str(e)}', status=500)

# Get a user profile
@https_fn.on_request()
def get_user(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'GET':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        username = req.args.get('username')
        if not username:
            return https_fn.Response('Username is required', status=400)
        
        user_ref = db.collection('users').document(username)
        doc = user_ref.get()
        
        if not doc.exists:
            return https_fn.Response('User not found', status=404)
        
        user_data = doc.to_dict()
        followers = db.collection('followers').document(username).collection('user_followers').get()
        following = db.collection('following').document(username).collection('user_following').get()
        
        user_data['followers_count'] = len(list(followers))
        user_data['following_count'] = len(list(following))
        
        return https_fn.Response(json.dumps(user_data), status=200)
    except Exception as e:
        return https_fn.Response(f'Error: {str(e)}', status=500)

# Follow a user
@https_fn.on_request()
def follow_user(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        data = req.get_json()
        username = data.get('username')
        target_username = data.get('target_username')
        
        if not username or not target_username:
            return https_fn.Response('Username and target_username are required', status=400)
        
        if username == target_username:
            return https_fn.Response('Cannot follow yourself', status=400)
        
        # Check if both users exist
        user_ref = db.collection('users').document(username)
        target_ref = db.collection('users').document(target_username)
        
        if not user_ref.get().exists or not target_ref.get().exists:
            return https_fn.Response('User not found', status=404)
        
        # Add to following collection
        following_ref = db.collection('following').document(username).collection('user_following').document(target_username)
        followers_ref = db.collection('followers').document(target_username).collection('user_followers').document(username)
        
        # Check if already following
        if following_ref.get().exists:
            return https_fn.Response('Already following this user', status=400)
        
        # Create the following relationship
        following_ref.set({'timestamp': firestore.SERVER_TIMESTAMP})
        followers_ref.set({'timestamp': firestore.SERVER_TIMESTAMP})
        
        # Create activity
        create_activity(username, 'follow', target_username, 'user')
        
        return https_fn.Response(json.dumps({'message': f'Now following {target_username}'}), status=200)
    except Exception as e:
        return https_fn.Response(f'Error: {str(e)}', status=500)

# Get user's cooking feed
@https_fn.on_request()
def get_user_feed(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'GET':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        username = req.args.get('username')
        if not username:
            return https_fn.Response('Username is required', status=400)
        
        user_ref = db.collection('users').document(username)
        if not user_ref.get().exists:
            return https_fn.Response('User not found', status=404)
        
        # Get list of users being followed
        following_ref = db.collection('following').document(username).collection('user_following').stream()
        followed_users = [followed.id for followed in following_ref]
        
        if not followed_users:
            return https_fn.Response(json.dumps({'recipe_posts': []}), status=200)
        
        # Get recipe posts from followed users
        posts = []
        posts_ref = db.collection('recipe_posts').where('username', 'in', followed_users).order_by('created_at', direction=firestore.Query.DESCENDING).limit(50)
        
        for post in posts_ref.stream():
            post_data = post.to_dict()
            # Get user info
            user_data = db.collection('users').document(post_data['username']).get().to_dict()
            if user_data:
                post_data['user'] = {
                    'username': post_data['username'],
                    'name': user_data.get('name')
                }
            posts.append(post_data)
        
        return https_fn.Response(json.dumps({'recipe_posts': posts}), status=200)
    except Exception as e:
        return https_fn.Response(f'Error: {str(e)}', status=500)

# Create a new recipe post
@https_fn.on_request()
def create_recipe_post(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        data = req.get_json()
        username = data.get('username')
        recipe_name = data.get('recipe_name')
        rating = data.get('rating')
        
        if not username or not recipe_name or rating is None:
            return https_fn.Response('Username, recipe_name, and rating are required', status=400)
        
        if not (0 <= rating <= 5):
            return https_fn.Response('Rating must be between 0 and 5', status=400)
        
        user_ref = db.collection('users').document(username)
        if not user_ref.get().exists:
            return https_fn.Response('User not found', status=404)
        
        post_id = str(uuid.uuid4())
        post_data = {
            'id': post_id,
            'username': username,
            'recipe_name': recipe_name,
            'rating': rating,
            'cooking_notes': data.get('cooking_notes', ''),
            'tips': data.get('tips', ''),
            'modifications': data.get('modifications', ''),
            'cooking_time': data.get('cooking_time', ''),
            'difficulty_level': data.get('difficulty_level', ''),
            'created_at': firestore.SERVER_TIMESTAMP,
            'likes_count': 0,
            'comments_count': 0,
            'recooks_count': 0
        }
        
        # Save post to Firestore
        db.collection('recipe_posts').document(post_id).set(post_data)
        
        # Add to user's recipe posts collection
        user_posts_ref = db.collection('users').document(username).collection('recipe_posts').document(post_id)
        user_posts_ref.set({'post_ref': db.collection('recipe_posts').document(post_id)})
        
        # Create activity
        create_activity(username, 'cooked', post_id, 'recipe')
        
        return https_fn.Response(json.dumps({'message': 'Recipe post created', 'post_id': post_id}), status=201)
    except Exception as e:
        return https_fn.Response(f'Error: {str(e)}', status=500)

# Get a specific recipe post
@https_fn.on_request()
def get_recipe_post(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'GET':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        post_id = req.args.get('post_id')
        if not post_id:
            return https_fn.Response('Post ID is required', status=400)
        
        post_ref = db.collection('recipe_posts').document(post_id)
        post = post_ref.get()
        
        if not post.exists:
            return https_fn.Response('Recipe not found', status=404)
        
        post_data = post.to_dict()
        
        # Get user info
        user_data = db.collection('users').document(post_data['username']).get().to_dict()
        if user_data:
            post_data['user'] = {
                'username': post_data['username'],
                'name': user_data.get('name')
            }
        
        # If this is a re-cooked recipe, get original recipe info
        if 'original_recipe_id' in post_data:
            original_recipe = db.collection('recipe_posts').document(post_data['original_recipe_id']).get()
            if original_recipe.exists:
                original_data = original_recipe.to_dict()
                post_data['original_recipe'] = {
                    'id': original_data['id'],
                    'recipe_name': original_data['recipe_name'],
                    'username': original_data['username'],
                    'rating': original_data['rating']
                }
        
        return https_fn.Response(json.dumps(post_data), status=200)
    except Exception as e:
        return https_fn.Response(f'Error: {str(e)}', status=500)

# Re-cook a recipe
@https_fn.on_request()
def recook_recipe(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        data = req.get_json()
        username = data.get('username')
        recipe_id = data.get('recipe_id')
        
        if not username or not recipe_id:
            return https_fn.Response('Username and recipe_id are required', status=400)
        
        user_ref = db.collection('users').document(username)
        original_post_ref = db.collection('recipe_posts').document(recipe_id)
        
        if not user_ref.get().exists:
            return https_fn.Response('User not found', status=404)
        
        original_post = original_post_ref.get()
        if not original_post.exists:
            return https_fn.Response('Recipe not found', status=404)
        
        original_data = original_post.to_dict()
        
        # Create new recipe post with reference to original
        new_post_id = str(uuid.uuid4())
        new_post_data = {
            'id': new_post_id,
            'username': username,
            'recipe_name': original_data['recipe_name'],
            'original_recipe_id': recipe_id,
            'original_chef': original_data['username'],
            'rating': data.get('rating'),
            'cooking_notes': data.get('cooking_notes', ''),
            'tips': data.get('tips', ''),
            'modifications': data.get('modifications', ''),
            'cooking_time': data.get('cooking_time', original_data.get('cooking_time')),
            'difficulty_level': data.get('difficulty_level', original_data.get('difficulty_level')),
            'created_at': firestore.SERVER_TIMESTAMP,
            'likes_count': 0,
            'comments_count': 0,
            'recooks_count': 0
        }
        
        # Save new recipe post
        db.collection('recipe_posts').document(new_post_id).set(new_post_data)
        
        # Add to user's recipe posts collection
        user_posts_ref = db.collection('users').document(username).collection('recipe_posts').document(new_post_id)
        user_posts_ref.set({'post_ref': db.collection('recipe_posts').document(new_post_id)})
        
        # Increment recooks count on original recipe
        original_post_ref.update({
            'recooks_count': firestore.Increment(1)
        })
        
        # Create activity
        create_activity(username, 'recooked', recipe_id, 'recipe')
        
        return https_fn.Response(json.dumps({'message': 'Recipe re-cooked', 'post_id': new_post_id}), status=201)
    except Exception as e:
        return https_fn.Response(f'Error: {str(e)}', status=500)

# Triggered when a new recipe is created
@firestore_fn.on_document_created('recipe_posts/{recipe_id}')
def on_recipe_created(event):
    """Updates user stats when a new recipe is created"""
    recipe_data = event.data.to_dict()
    username = recipe_data['username']
    
    # Update user's recipe count
    db.collection('users').document(username).update({
        'total_recipes': firestore.Increment(1)
    })