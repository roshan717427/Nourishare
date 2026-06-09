# Munchable v4 API Testing Reference

Reference for manually testing the live Vercel API endpoints. For a runnable
version of all of these, see [`scripts/test_api.sh`](../scripts/test_api.sh).

Base URL: `https://munchable-v4.vercel.app` (override with your own deployment
URL if different).

> **Social + login are consolidated.** The follow/unfollow/followers/following/
> feed/login operations all live behind a single serverless function at
> `/api/social`, selected via the `action` query parameter. The old
> `/api/followUser`, `/api/getFollowers`, `/api/loginUser`, etc. routes no
> longer exist.

---

## 1. User Profile

### 1.1 Create User Profile
```bash
curl -X POST https://munchable-v4.vercel.app/api/createUserProfile \
  -H "Content-Type: application/json" \
  -d '{
    "username": "roshan",
    "name": "Roshan",
    "email": "roshan@email.com",
    "bio": "Food enthusiast and home cook",
    "kitchenPersona": "Experimental chef",
    "topDishes": ["Pasta", "Curry", "Ramen"],
    "favoriteIngredients": ["Garlic", "Ginger", "Chili"],
    "cookingStats": {"total_meals": 15, "streak": 5, "favorite_cuisine": "Italian"}
  }'
```

### 1.2 Log In User (consolidated social endpoint)
By username:
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan"}'
```
By email:
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"email": "emily@email.com"}'
```

### 1.3 Get User Profile
```bash
curl -X GET "https://munchable-v4.vercel.app/api/getUserProfile?username=roshan"
```

### 1.4 Update User Profile
```bash
curl -X PATCH https://munchable-v4.vercel.app/api/updateUserProfile \
  -H "Content-Type: application/json" \
  -d '{
    "username": "roshan",
    "bio": "Updated bio: Food enthusiast and experimental chef",
    "cookingStats": {"total_meals": 20, "streak": 8, "favorite_cuisine": "Italian"}
  }'
```

### 1.5 Delete User Profile (cleanup)
```bash
curl -X DELETE https://munchable-v4.vercel.app/api/deleteUserProfile \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan"}'
```

---

## 2. Recipe Logging

### 2.1 Create Recipe Log
```bash
curl -X POST https://munchable-v4.vercel.app/api/createRecipeLog \
  -H "Content-Type: application/json" \
  -d '{
    "username": "roshan",
    "title": "Creamy Garlic Pasta",
    "ingredients": ["pasta", "garlic", "cream", "parmesan", "basil"],
    "notes": "Delicious and creamy! Added extra garlic.",
    "rating": 5,
    "difficulty": "easy",
    "time": "30 minutes",
    "source": "NYT Cooking",
    "recipeLink": "https://cooking.nytimes.com/recipes/pasta"
  }'
```

### 2.2 Get All Recipe Logs
```bash
curl -X POST https://munchable-v4.vercel.app/api/getRecipeLog \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan"}'
```

### 2.3 Update Recipe Log
Replace `LOG_ID_HERE` with an actual `logId` from the get call above.
```bash
curl -X POST https://munchable-v4.vercel.app/api/updateRecipeLog \
  -H "Content-Type: application/json" \
  -d '{
    "username": "roshan",
    "logId": "LOG_ID_HERE",
    "updates": {"rating": 5, "notes": "Updated notes: Even better the second time!"}
  }'
```

### 2.4 Delete Recipe Log
```bash
curl -X POST https://munchable-v4.vercel.app/api/deleteRecipeLog \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan", "logId": "LOG_ID_HERE"}'
```

---

## 3. Kitchen Personality Analysis

```bash
curl -X POST https://munchable-v4.vercel.app/api/analyzePersonality \
  -H "Content-Type: application/json" \
  -d '{"user_id": "roshan"}'
```

---

## 4. Social Features (consolidated `/api/social`)

### 4.1 Follow
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=follow" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan", "targetUsername": "emily"}'
```

### 4.2 Unfollow
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=unfollow" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan", "targetUsername": "emily"}'
```

### 4.3 Followers
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=followers&username=emily"
```

### 4.4 Following
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=following&username=roshan"
```

### 4.5 Feed
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=feed&username=roshan"
```

---

## 5. Smart Suggestions

> Requires users to follow each other (section 4) for the friends section to
> appear. Friend picks come from meals friends have logged or posted.

```bash
curl -X POST https://munchable-v4.vercel.app/api/getSuggestions \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan", "limit": 5}'
```

Response includes `has_friends` (true when the user follows at least one person)
and `friend_suggestions` (recipes drawn from friends' logs and posts).

---

## Recommended Testing Order

1. **Create users** (1.1)
2. **Create recipe logs** (2.1)
3. **Analyze personalities** (3) — requires recipe logs to exist
4. **Follow users + feed** (4) — enables social recipes
5. **Get suggestions** (5) — friends section appears once you follow someone
6. **Update/Delete operations** (1.4, 1.5, 2.3, 2.4) — optional cleanup

## Endpoint Summary

| Feature | Method | Endpoint |
| --- | --- | --- |
| Create profile | POST | `/api/createUserProfile` |
| Get profile | GET | `/api/getUserProfile?username=...` |
| Update profile | PATCH | `/api/updateUserProfile` |
| Delete profile | DELETE | `/api/deleteUserProfile` |
| Create recipe log | POST | `/api/createRecipeLog` |
| Get recipe logs | POST | `/api/getRecipeLog` |
| Update recipe log | POST | `/api/updateRecipeLog` |
| Delete recipe log | POST | `/api/deleteRecipeLog` |
| Personality analysis | POST | `/api/analyzePersonality` |
| Smart suggestions | POST | `/api/getSuggestions` |
| Login | POST | `/api/social?action=login` |
| Follow | POST | `/api/social?action=follow` |
| Unfollow | POST | `/api/social?action=unfollow` |
| Followers | GET | `/api/social?action=followers&username=...` |
| Following | GET | `/api/social?action=following&username=...` |
| Feed | GET | `/api/social?action=feed&username=...` |
