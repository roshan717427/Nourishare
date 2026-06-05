from flask import Flask, request, jsonify
from firestore_connect import db
from google.cloud import firestore
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)

# Configure upload folder for images
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# Update a user profile
@app.route('/users/<username>', methods=['PATCH'])
def update_user(username):
    data = request.json
    user_ref = db.collection('users').document(username)
    doc = user_ref.get()
    if not doc.exists:
        return jsonify({'error': 'User not found'}), 404
    user_ref.update(data)
    return jsonify({'message': 'User updated'}), 200

# Create an activity
def create_activity(actor_username, activity_type, target_id, target_type):
    activity_id = str(uuid.uuid4())
    activity_data = {
        'id': activity_id,
        'actor_username': actor_username,
        'activity_type': activity_type,  # 'like', 'comment', 'follow'
        'target_id': target_id,
        'target_type': target_type,  # 'post', 'user'
        'timestamp': firestore.SERVER_TIMESTAMP
    }
    
    # Add to global activity feed
    db.collection('activities').document(activity_id).set(activity_data)
    
    # Add to user's activity collection
    db.collection('users').document(actor_username).collection('activities').document(activity_id).set(activity_data)
    
    return activity_id

# Get user's activity feed
@app.route('/users/<username>/activity', methods=['GET'])
def get_user_activity(username):
    user_ref = db.collection('users').document(username)
    if not user_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
    
    activities = []
    activities_ref = db.collection('activities').where('actor_username', '==', username).order_by('timestamp', direction=firestore.Query.DESCENDING).limit(50)
    
    for activity in activities_ref.stream():
        activity_data = activity.to_dict()
        
        # Get actor user data
        actor_data = db.collection('users').document(activity_data['actor_username']).get().to_dict()
        if actor_data:
            activity_data['actor'] = {
                'username': activity_data['actor_username'],
                'name': actor_data.get('name')
            }
        
        # Get target data based on type
        if activity_data['target_type'] == 'post':
            post_data = db.collection('posts').document(activity_data['target_id']).get().to_dict()
            if post_data:
                activity_data['target'] = {
                    'id': activity_data['target_id'],
                    'text': post_data.get('text', ''),
                    'image_url': post_data.get('image_url')
                }
        elif activity_data['target_type'] == 'user':
            target_data = db.collection('users').document(activity_data['target_id']).get().to_dict()
            if target_data:
                activity_data['target'] = {
                    'username': activity_data['target_id'],
                    'name': target_data.get('name')
                }
        
        activities.append(activity_data)
    
    return jsonify({'activities': activities}), 200

# Follow a user
@app.route('/users/<username>/follow/<target_username>', methods=['POST'])
def follow_user(username, target_username):
    # Check if both users exist
    user_ref = db.collection('users').document(username)
    target_ref = db.collection('users').document(target_username)
    
    if not user_ref.get().exists or not target_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
    
    if username == target_username:
        return jsonify({'error': 'Cannot follow yourself'}), 400
        
    # Add to following collection
    following_ref = db.collection('following').document(username).collection('user_following').document(target_username)
    # Add to followers collection
    followers_ref = db.collection('followers').document(target_username).collection('user_followers').document(username)
    
    # Check if already following
    if following_ref.get().exists:
        return jsonify({'error': 'Already following this user'}), 400
        
    # Create the following relationship
    following_ref.set({'timestamp': firestore.SERVER_TIMESTAMP})
    followers_ref.set({'timestamp': firestore.SERVER_TIMESTAMP})
    
    # Create activity
    create_activity(username, 'follow', target_username, 'user')
    
    return jsonify({'message': f'Now following {target_username}'}), 200

# Unfollow a user
@app.route('/users/<username>/unfollow/<target_username>', methods=['POST'])
def unfollow_user(username, target_username):
    # Check if both users exist
    user_ref = db.collection('users').document(username)
    target_ref = db.collection('users').document(target_username)
    
    if not user_ref.get().exists or not target_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
        
    # Remove from following collection
    following_ref = db.collection('following').document(username).collection('user_following').document(target_username)
    # Remove from followers collection
    followers_ref = db.collection('followers').document(target_username).collection('user_followers').document(username)
    
    # Check if actually following
    if not following_ref.get().exists:
        return jsonify({'error': 'Not following this user'}), 400
        
    # Remove the following relationship
    following_ref.delete()
    followers_ref.delete()
    
    return jsonify({'message': f'Unfollowed {target_username}'}), 200

# Get user's followers
@app.route('/users/<username>/followers', methods=['GET'])
def get_followers(username):
    if not db.collection('users').document(username).get().exists:
        return jsonify({'error': 'User not found'}), 404
        
    followers = []
    followers_ref = db.collection('followers').document(username).collection('user_followers').stream()
    
    for follower in followers_ref:
        follower_data = db.collection('users').document(follower.id).get().to_dict()
        if follower_data:
            followers.append({
                'username': follower.id,
                'name': follower_data.get('name'),
                'timestamp': follower.to_dict().get('timestamp')
            })
    
    return jsonify({'followers': followers}), 200

# Get users being followed
@app.route('/users/<username>/following', methods=['GET'])
def get_following(username):
    if not db.collection('users').document(username).get().exists:
        return jsonify({'error': 'User not found'}), 404
        
    following = []
    following_ref = db.collection('following').document(username).collection('user_following').stream()
    
    for followed in following_ref:
        followed_data = db.collection('users').document(followed.id).get().to_dict()
        if followed_data:
            following.append({
                'username': followed.id,
                'name': followed_data.get('name'),
                'timestamp': followed.to_dict().get('timestamp')
            })
    
    return jsonify({'following': following}), 200

# Get recipe's re-cooks
@app.route('/posts/<post_id>/recooks', methods=['GET'])
def get_recipe_recooks(post_id):
    post_ref = db.collection('recipe_posts').document(post_id)
    
    if not post_ref.get().exists:
        return jsonify({'error': 'Recipe not found'}), 404
    
    recooks = []
    recooks_ref = db.collection('recipe_posts').where('original_recipe_id', '==', post_id).order_by('created_at', direction=firestore.Query.DESCENDING)
    
    for recook in recooks_ref.stream():
        recook_data = recook.to_dict()
        user_data = db.collection('users').document(recook_data['username']).get().to_dict()
        if user_data:
            recook_data['user'] = {
                'username': recook_data['username'],
                'name': user_data.get('name')
            }
        recooks.append(recook_data)
    
    return jsonify({'recooks': recooks}), 200

# Get user's cooking feed (recipes from followed users)
@app.route('/users/<username>/feed', methods=['GET'])
def get_user_feed(username):
    user_ref = db.collection('users').document(username)
    if not user_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
    
    # Get list of users being followed
    following_ref = db.collection('following').document(username).collection('user_following').stream()
    followed_users = [followed.id for followed in following_ref]
    
    if not followed_users:
        return jsonify({'recipe_posts': []}), 200
    
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
    
    return jsonify({'recipe_posts': posts}), 200

# Re-cook a recipe (save with optional modifications)
@app.route('/posts/<post_id>/recook', methods=['POST'])
def recook_recipe(post_id):
    if 'username' not in request.json:
        return jsonify({'error': 'Username is required'}), 400
        
    username = request.json['username']
    user_ref = db.collection('users').document(username)
    original_post_ref = db.collection('recipe_posts').document(post_id)
    
    if not user_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
    
    original_post = original_post_ref.get()
    if not original_post.exists:
        return jsonify({'error': 'Recipe not found'}), 404
    
    original_data = original_post.to_dict()
    
    # Create new recipe post with reference to original
    new_post_id = str(uuid.uuid4())
    new_post_data = {
        'id': new_post_id,
        'username': username,
        'recipe_name': original_data['recipe_name'],
        'original_recipe_id': post_id,
        'original_chef': original_data['username'],
        'rating': request.json.get('rating'),
        'cooking_notes': request.json.get('cooking_notes', ''),
        'tips': request.json.get('tips', ''),
        'modifications': request.json.get('modifications', ''),
        'cooking_time': request.json.get('cooking_time', original_data.get('cooking_time')),
        'difficulty_level': request.json.get('difficulty_level', original_data.get('difficulty_level')),
        'created_at': firestore.SERVER_TIMESTAMP,
        'likes_count': 0,
        'comments_count': 0,
        'recooks_count': 0
    }
    
    # Handle new dish photo if present
    if 'dish_photo' in request.files:
        image = request.files['dish_photo']
        if image and allowed_file(image.filename):
            filename = secure_filename(f"{new_post_id}_{image.filename}")
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image.save(image_path)
            new_post_data['dish_photo_url'] = f"/uploads/{filename}"
    
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
    create_activity(username, 'recooked', post_id, 'recipe')
    
    return jsonify({'message': 'Recipe re-cooked', 'post_id': new_post_id}), 201

# Like a post
@app.route('/posts/<post_id>/like', methods=['POST'])
def like_post(post_id):
    if 'username' not in request.json:
        return jsonify({'error': 'Username is required'}), 400
        
    username = request.json['username']
    user_ref = db.collection('users').document(username)
    post_ref = db.collection('posts').document(post_id)
    
    if not user_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
    
    if not post_ref.get().exists:
        return jsonify({'error': 'Post not found'}), 404
    
    # Check if user already liked the post
    like_ref = db.collection('posts').document(post_id).collection('likes').document(username)
    if like_ref.get().exists:
        return jsonify({'error': 'Already liked this post'}), 400
    
    # Add like
    like_ref.set({
        'username': username,
        'timestamp': firestore.SERVER_TIMESTAMP
    })
    
    # Increment likes count
    post_ref.update({
        'likes_count': firestore.Increment(1)
    })
    
    # Create activity
    create_activity(username, 'like', post_id, 'post')
    
    return jsonify({'message': 'Post liked'}), 200

# Unlike a post
@app.route('/posts/<post_id>/unlike', methods=['POST'])
def unlike_post(post_id):
    if 'username' not in request.json:
        return jsonify({'error': 'Username is required'}), 400
        
    username = request.json['username']
    user_ref = db.collection('users').document(username)
    post_ref = db.collection('posts').document(post_id)
    
    if not user_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
    
    if not post_ref.get().exists:
        return jsonify({'error': 'Post not found'}), 404
    
    # Check if user has liked the post
    like_ref = db.collection('posts').document(post_id).collection('likes').document(username)
    if not like_ref.get().exists:
        return jsonify({'error': 'Haven\'t liked this post'}), 400
    
    # Remove like
    like_ref.delete()
    
    # Decrement likes count
    post_ref.update({
        'likes_count': firestore.Increment(-1)
    })
    
    return jsonify({'message': 'Post unliked'}), 200

# Get users who liked a post
@app.route('/posts/<post_id>/likes', methods=['GET'])
def get_post_likes(post_id):
    post_ref = db.collection('posts').document(post_id)
    
    if not post_ref.get().exists:
        return jsonify({'error': 'Post not found'}), 404
    
    likes = []
    likes_ref = post_ref.collection('likes').order_by('timestamp', direction=firestore.Query.DESCENDING)
    
    for like in likes_ref.stream():
        like_data = like.to_dict()
        user_data = db.collection('users').document(like_data['username']).get().to_dict()
        if user_data:
            likes.append({
                'username': like_data['username'],
                'name': user_data.get('name'),
                'timestamp': like_data['timestamp']
            })
    
    return jsonify({'likes': likes}), 200

# Add a comment to a post
@app.route('/posts/<post_id>/comments', methods=['POST'])
def add_comment(post_id):
    if 'username' not in request.json or 'text' not in request.json:
        return jsonify({'error': 'Username and text are required'}), 400
        
    username = request.json['username']
    text = request.json['text']
    
    user_ref = db.collection('users').document(username)
    post_ref = db.collection('posts').document(post_id)
    
    if not user_ref.get().exists:
        return jsonify({'error': 'User not found'}), 404
    
    if not post_ref.get().exists:
        return jsonify({'error': 'Post not found'}), 404
    
    comment_id = str(uuid.uuid4())
    comment_data = {
        'id': comment_id,
        'username': username,
        'text': text,
        'timestamp': firestore.SERVER_TIMESTAMP
    }
    
    # Add comment
    comment_ref = post_ref.collection('comments').document(comment_id)
    comment_ref.set(comment_data)
    
    # Increment comments count
    post_ref.update({
        'comments_count': firestore.Increment(1)
    })
    
    # Create activity
    create_activity(username, 'comment', post_id, 'post')
    
    return jsonify({'message': 'Comment added', 'comment_id': comment_id}), 201

# Delete a comment
@app.route('/posts/<post_id>/comments/<comment_id>', methods=['DELETE'])
def delete_comment(post_id, comment_id):
    if 'username' not in request.json:
        return jsonify({'error': 'Username is required'}), 400
        
    username = request.json['username']
    post_ref = db.collection('posts').document(post_id)
    
    if not post_ref.get().exists:
        return jsonify({'error': 'Post not found'}), 404
    
    comment_ref = post_ref.collection('comments').document(comment_id)
    comment = comment_ref.get()
    
    if not comment.exists:
        return jsonify({'error': 'Comment not found'}), 404
    
    # Check if user owns the comment
    if comment.to_dict()['username'] != username:
        return jsonify({'error': 'Not authorized to delete this comment'}), 403
    
    # Delete comment
    comment_ref.delete()
    
    # Decrement comments count
    post_ref.update({
        'comments_count': firestore.Increment(-1)
    })
    
    return jsonify({'message': 'Comment deleted'}), 200

# Get comments for a post
@app.route('/posts/<post_id>/comments', methods=['GET'])
def get_post_comments(post_id):
    post_ref = db.collection('posts').document(post_id)
    
    if not post_ref.get().exists:
        return jsonify({'error': 'Post not found'}), 404
    
    comments = []
    comments_ref = post_ref.collection('comments').order_by('timestamp', direction=firestore.Query.ASCENDING)
    
    for comment in comments_ref.stream():
        comment_data = comment.to_dict()
        user_data = db.collection('users').document(comment_data['username']).get().to_dict()
        if user_data:
            comment_data['user'] = {
                'username': comment_data['username'],
                'name': user_data.get('name')
            }
            comments.append(comment_data)
    
    return jsonify({'comments': comments}), 200

if __name__ == '__main__':
    app.run(debug=True)
