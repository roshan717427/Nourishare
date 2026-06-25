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

### Authentication

Many endpoints require a Firebase ID token. Pass it on every protected call:

```bash
-H "Authorization: Bearer YOUR_ID_TOKEN"
```

Replace `YOUR_ID_TOKEN` with a real Firebase ID token (from the app after sign-in,
or from the Firebase Auth REST API). Where a request body includes `username`,
that value must match the username resolved from the token — otherwise the API
returns `403 Forbidden`.

**Public (no token required):** `GET /api/getUserProfile?username=...`,
`POST /api/social?action=login`, `GET /api/social?action=followers`, etc.
(read-only social queries that do not list private data).

**Token required:** profile create/update/delete, recipe log mutations, social
writes (follow, unfollow, accept/decline requests, likes, comments, etc.), and
`GET /api/getUserProfile?me=1`.

---

## 1. User Profile

### 1.1 Create User Profile
Requires auth. `username` in the body must match the token. `firstName` and
`lastName` must be letters only (A–Z).
```bash
curl -X POST https://munchable-v4.vercel.app/api/createUserProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "firstName": "Roshan",
    "lastName": "Paul",
    "email": "roshan@email.com",
    "bio": "Food enthusiast and home cook",
    "kitchenPersona": "Experimental chef",
    "topDishes": ["Beetroot Risotto", "Moussaka"],
    "favoriteIngredients": ["Garlic", "Ginger", "Chili"]
  }'
```

### 1.2 Log In User (consolidated social endpoint)
No auth required. Returns profile fields for an existing user (lookup only — not
a token exchange).
By username:
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"username": "rosh"}'
```
By email:
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"email": "emily@email.com"}'
```

### 1.3 Get User Profile
Public lookup by username:
```bash
curl -X GET "https://munchable-v4.vercel.app/api/getUserProfile?username=rosh"
```

Authenticated own profile (`?me=1` — username comes from the token):
```bash
curl -X GET "https://munchable-v4.vercel.app/api/getUserProfile?me=1" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

### 1.4 Update User Profile
Requires auth. Allowed fields: `name`, `bio`, `profilePhotoUrl`,
`kitchen_personality`, `portfolio_favorites`, and related flags.
```bash
curl -X PATCH https://munchable-v4.vercel.app/api/updateUserProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "bio": "Updated bio: Food enthusiast and experimental chef"
  }'
```

### 1.5 Delete User Profile (cleanup)
Requires auth.
```bash
curl -X DELETE https://munchable-v4.vercel.app/api/deleteUserProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "rosh"}'
```

---

## 2. Recipe Logging

### 2.1 Create Recipe Log
Requires auth. Provide `recipeLink` **or** `recipeInstructions` (at least one).
```bash
curl -X POST https://munchable-v4.vercel.app/api/createRecipeLog \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "title": "Creamy Garlic Pasta",
    "ingredients": "pasta, garlic, cream, parmesan, basil",
    "notes": "Delicious and creamy! Added extra garlic.",
    "rating": 5,
    "difficulty": "easy",
    "time": "30 minutes",
    "recipeLink": "https://cooking.nytimes.com/recipes/pasta"
  }'
```

### 2.2 Get All Recipe Logs
No auth required when listing by username.
```bash
curl -X POST https://munchable-v4.vercel.app/api/getRecipeLog \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan"}'
```

Get a single log by id (requires auth; log must belong to the token user):
```bash
curl -X POST https://munchable-v4.vercel.app/api/getRecipeLog \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "logId": "LOG_ID_HERE"}'
```

### 2.3 Update Recipe Log
Replace `LOG_ID_HERE` with an actual `logId` from the get call above. Requires auth.
```bash
curl -X POST https://munchable-v4.vercel.app/api/updateRecipeLog \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "logId": "LOG_ID_HERE",
    "updates": {"rating": 5, "notes": "Updated notes: Even better the second time!"}
  }'
```

### 2.4 Delete Recipe Log
Requires auth.
```bash
curl -X POST https://munchable-v4.vercel.app/api/deleteRecipeLog \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "logId": "LOG_ID_HERE"}'
```

> Kitchen personality is refreshed automatically when recipe logs are created or
> deleted, and when a stale profile is fetched via `getUserProfile`. There is no
> standalone `/api/analyzePersonality` endpoint.

---

## 3. Social Features (consolidated `/api/social`)

Follows use a **request/accept** flow: `follow` creates a pending request;
the target user must call `acceptFollowRequest` before the relationship is
established.

### 3.1 Follow (sends pending request)
Requires auth.
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=follow" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "targetUsername": "emily"}'
```

### 3.2 Accept Follow Request
Requires auth. `username` is the person **accepting**; `fromUsername` is the requester.
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=acceptFollowRequest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "emily", "fromUsername": "roshan"}'
```

### 3.3 Decline Follow Request
Requires auth.
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=declineFollowRequest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "emily", "fromUsername": "roshan"}'
```

### 3.4 Unfollow
Requires auth. Also cancels a pending outgoing follow request.
```bash
curl -X POST "https://munchable-v4.vercel.app/api/social?action=unfollow" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "targetUsername": "emily"}'
```

### 3.5 Followers
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=followers&username=emily"
```

### 3.6 Following
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=following&username=roshan"
```

### 3.7 Feed
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=feed&username=roshan"
```

### 3.8 Notifications
Requires auth.
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=notifications&username=roshan" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

### 3.9 Search Users
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=searchUsers&q=ros"
```

### 3.10 User Logs (public meal history)
```bash
curl -X GET "https://munchable-v4.vercel.app/api/social?action=userLogs&username=roshan"
```

---

## Recommended Testing Order

1. **Sign in via Firebase** and obtain an ID token (`YOUR_ID_TOKEN`)
2. **Create profile** (1.1) — requires token
3. **Create recipe logs** (2.1)
4. **Follow flow** (3.1 → 3.2) — request then accept
5. **Feed + followers** (3.5–3.7) — verify social graph
6. **Get own profile** (1.3 `?me=1`) — verify live stats
7. **Update/Delete operations** (1.4, 1.5, 2.3, 2.4) — optional cleanup

## Endpoint Summary

| Feature | Method | Endpoint | Auth |
| --- | --- | --- | --- |
| Create profile | POST | `/api/createUserProfile` | Bearer |
| Get profile (public) | GET | `/api/getUserProfile?username=...` | — |
| Get own profile | GET | `/api/getUserProfile?me=1` | Bearer |
| Update profile | PATCH | `/api/updateUserProfile` | Bearer |
| Delete profile | DELETE | `/api/deleteUserProfile` | Bearer |
| Create recipe log | POST | `/api/createRecipeLog` | Bearer |
| Get recipe logs | POST | `/api/getRecipeLog` | Bearer if `logId` set |
| Update recipe log | POST | `/api/updateRecipeLog` | Bearer |
| Delete recipe log | POST | `/api/deleteRecipeLog` | Bearer |
| Login (lookup) | POST | `/api/social?action=login` | — |
| Follow (request) | POST | `/api/social?action=follow` | Bearer |
| Accept follow | POST | `/api/social?action=acceptFollowRequest` | Bearer |
| Decline follow | POST | `/api/social?action=declineFollowRequest` | Bearer |
| Unfollow | POST | `/api/social?action=unfollow` | Bearer |
| Followers | GET | `/api/social?action=followers&username=...` | — |
| Following | GET | `/api/social?action=following&username=...` | — |
| Feed | GET | `/api/social?action=feed&username=...` | — |
| Notifications | GET | `/api/social?action=notifications&username=...` | Bearer |
| Search users | GET | `/api/social?action=searchUsers&q=...` | — |
| User logs | GET | `/api/social?action=userLogs&username=...` | — |
