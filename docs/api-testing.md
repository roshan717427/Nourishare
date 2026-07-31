# Nourishare API Testing Reference

Reference for manually testing the live Vercel API. For a runnable smoke test, see
[`scripts/test_api.sh`](../scripts/test_api.sh).

**Base URL:** `https://nourishare.vercel.app`  
(Override with your own deployment if different. The mobile app uses
`https://nourishare.vercel.app/api` in `config/api.js`.)

Fixture usernames in examples below are placeholders — override in the shell
script via `TEST_USERNAME` / `TEST_USERNAME_2`.

> **Consolidated routes**
>
> - Social + login → `/api/social?action=…`
> - Recipe log create/update/delete → `/api/recipeLog?action=create|update|delete`
> - Meal history listing → `/api/social?action=userLogs` (auth required; others’ logs require following)
> - AI suggestions → `/api/aiSuggestions?action=loadCached|generate|hide`
> - Meal plan → `/api/mealPlan?action=getMealPlan|scheduleRecipe|moveMealPlanEntry|removeMealPlanEntry|shoppingList`
>
> Legacy paths like `/api/createRecipeLog` or `/api/followUser` are **not** deployed.

### Authentication

Many endpoints require a Firebase ID token:

```bash
-H "Authorization: Bearer YOUR_ID_TOKEN"
```

Where a body includes `username`, it must match the username resolved from the
token or the API returns `403`.

**Typically public:** `GET /api/getUserProfile?username=…`,
`POST /api/social?action=login`, `GET /api/social?action=signInEmail&username=…`,
`GET /api/social?action=searchUsers&q=…`, `GET /api/social?action=checkEmail|checkUsername`.

**Token required:** profile create/update/delete, recipe log mutations,
followers/following/feed/userLogs (and most other social reads/writes),
`GET /api/getUserProfile?me=1`, AI suggestions, meal plan.

**Internal only (not for mobile / manual smoke tests without the secret):**
`POST /api/getSuggestions` and `POST /api/analyzePersonality` require
`x-internal-secret` matching `INTERNAL_API_SECRET`. The Node AI route calls
`getSuggestions` server-to-server for Gemini fallback; personality refresh runs
in Node via `personalityHelper.js` on recipe create/delete.

---

## 1. User Profile

### 1.1 Create User Profile

Requires auth. `firstName` / `lastName` must be letters only (A–Z).
`acceptedTermsAt` and `acceptedTermsVersion` are required.

```bash
curl -X POST https://nourishare.vercel.app/api/createUserProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "firstName": "Roshan",
    "lastName": "Paul",
    "email": "roshan@email.com",
    "bio": "Food enthusiast and home cook",
    "acceptedTermsAt": "2026-07-24T00:00:00.000Z",
    "acceptedTermsVersion": "2026-07-23"
  }'
```

### 1.2 Log In User (lookup only — not a token exchange)

```bash
curl -X POST "https://nourishare.vercel.app/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan"}'
```

```bash
curl -X POST "https://nourishare.vercel.app/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"email": "emily@email.com"}'
```

Username → email for Firebase sign-in (what the app uses):

```bash
curl -X GET "https://nourishare.vercel.app/api/social?action=signInEmail&username=roshan"
```

### 1.3 Get User Profile

```bash
curl -X GET "https://nourishare.vercel.app/api/getUserProfile?username=roshan"
```

```bash
curl -X GET "https://nourishare.vercel.app/api/getUserProfile?me=1" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

Kitchen personality is stored on the user doc and refreshed on recipe
create/delete. Profile GET returns the stored persona (it does not re-scan all
logs for a full recompute).

### 1.4 Update User Profile

Allowed fields include `bio`, `name`, `profilePhotoUrl`, `kitchen_personality`,
`portfolio_favorites`, and related user-set cuisine/ingredient flags (see
`pickProfileUpdates` in `api/_helpers/validateInput.js`).

```bash
curl -X PATCH https://nourishare.vercel.app/api/updateUserProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "bio": "Updated bio"
  }'
```

### 1.5 Delete User Profile

Requires auth; `username` must match the token.

```bash
curl -X DELETE https://nourishare.vercel.app/api/deleteUserProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan"}'
```

---

## 2. Recipe Logging (`/api/recipeLog`)

### 2.1 Create

Requires auth. **Required:** `title`, `ingredients` (string), `rating`,
`difficulty`, `time`. Optional: `recipeLink`, `recipeInstructions`, `notes`,
`photoUrl`, `dishType`, `cookedWith` (username array).

`ingredients` is a **string** (e.g. comma-separated), not an array. Arrays are
coerced via `String(...)` and will not round-trip cleanly.

Either `recipeLink` or `recipeInstructions` (or both) may be sent; neither is
required by the API.

```bash
curl -X POST "https://nourishare.vercel.app/api/recipeLog?action=create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "title": "Creamy Garlic Pasta",
    "ingredients": "pasta, garlic, cream, parmesan, basil",
    "notes": "Delicious and creamy!",
    "rating": 5,
    "difficulty": "easy",
    "time": "30 minutes",
    "recipeLink": "https://cooking.nytimes.com/recipes/pasta"
  }'
```

### 2.2 List user logs (social)

Requires auth. Viewing another user’s logs requires following them.

```bash
curl -X GET "https://nourishare.vercel.app/api/social?action=userLogs&username=roshan" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

### 2.3 Update

```bash
curl -X POST "https://nourishare.vercel.app/api/recipeLog?action=update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "logId": "LOG_ID_HERE",
    "updates": {"rating": 5, "notes": "Even better the second time!"}
  }'
```

### 2.4 Delete

Cascades likes/comments for that post (best-effort).

```bash
curl -X POST "https://nourishare.vercel.app/api/recipeLog?action=delete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "logId": "LOG_ID_HERE"}'
```

---

## 3. Social Features (`/api/social`)

Follows use **request → accept**. `follow` creates a pending request.

### 3.1 Follow (pending request)

```bash
curl -X POST "https://nourishare.vercel.app/api/social?action=follow" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "targetUsername": "emily"}'
```

### 3.2 Accept / decline

```bash
curl -X POST "https://nourishare.vercel.app/api/social?action=acceptFollowRequest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "emily", "fromUsername": "roshan"}'
```

```bash
curl -X POST "https://nourishare.vercel.app/api/social?action=declineFollowRequest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "emily", "fromUsername": "roshan"}'
```

### 3.3 Unfollow

```bash
curl -X POST "https://nourishare.vercel.app/api/social?action=unfollow" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "targetUsername": "emily"}'
```

### 3.4 Read social (auth required except search)

```bash
curl -X GET "https://nourishare.vercel.app/api/social?action=followers&username=emily" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
curl -X GET "https://nourishare.vercel.app/api/social?action=following&username=roshan" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
curl -X GET "https://nourishare.vercel.app/api/social?action=feed&username=roshan" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
curl -X GET "https://nourishare.vercel.app/api/social?action=searchUsers&q=ros"
curl -X GET "https://nourishare.vercel.app/api/social?action=userLogs&username=roshan" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

### 3.5 Notifications

```bash
curl -X GET "https://nourishare.vercel.app/api/social?action=notifications&username=roshan" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

Other useful actions (all under `/api/social?action=`): `like`, `unlike`,
`addComment`, `deleteComment`, `report`, `block`, `unblock`, `blockedUsers`,
`registerPushToken`, `dismissNotification`, `portfolioFavorites`, `recook`, etc.

---

## 4. AI Suggestions (`/api/aiSuggestions`)

Requires auth. Always pass `?action=`. Load cache with GET; generate / hide with
POST. Daily limit: **3 generations per UTC day** (up to ~6 recipes each).

```bash
curl -X GET "https://nourishare.vercel.app/api/aiSuggestions?action=loadCached&username=roshan" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

```bash
curl -X POST "https://nourishare.vercel.app/api/aiSuggestions?action=generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "pantry_ingredients": ["eggs", "spinach"]}'
```

```bash
curl -X POST "https://nourishare.vercel.app/api/aiSuggestions?action=hide" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "recipeId": "RECIPE_ID_HERE"}'
```

Do **not** call `/api/getSuggestions` from the client — it is internal-only
(Gemini fallback).

---

## 5. Meal Plan (`/api/mealPlan`)

Requires auth (`username` must match the token). Used by `MealPlanScreen` via
`utils/mealPlanApi.js`.

```bash
# List entries in a date range
curl -X GET "https://nourishare.vercel.app/api/mealPlan?action=getMealPlan&username=roshan&startDate=2026-07-27&endDate=2026-08-02" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"

# Schedule a recipe onto a day
curl -X POST "https://nourishare.vercel.app/api/mealPlan?action=scheduleRecipe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{
    "username": "roshan",
    "date": "2026-07-28",
    "recipeId": "LOG_OR_RECIPE_ID",
    "recipeName": "Creamy Garlic Pasta",
    "ingredients": "pasta, garlic, cream",
    "difficulty_level": "easy",
    "cooking_time": "30 minutes"
  }'

# Move / remove
curl -X POST "https://nourishare.vercel.app/api/mealPlan?action=moveMealPlanEntry" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "entryId": "ENTRY_ID", "newDate": "2026-07-29"}'

curl -X POST "https://nourishare.vercel.app/api/mealPlan?action=removeMealPlanEntry" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"username": "roshan", "entryId": "ENTRY_ID"}'

# Aggregated shopping list for a range
curl -X GET "https://nourishare.vercel.app/api/mealPlan?action=shoppingList&username=roshan&startDate=2026-07-27&endDate=2026-08-02" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

---

## Recommended Testing Order

1. Sign in via Firebase → obtain `YOUR_ID_TOKEN`
2. Create profile (1.1) with terms fields
3. Create recipe log (2.1)
4. Follow flow (3.1 → 3.2) — needs a second user’s token to accept
5. Feed + followers (3.4)
6. Own profile `?me=1` (1.3)
7. Optional: AI generate (4), meal plan (5), cleanup delete (1.5 / 2.4)

## Endpoint Summary

| Feature | Method | Endpoint | Auth |
| --- | --- | --- | --- |
| Create profile | POST | `/api/createUserProfile` | Bearer |
| Get profile (public) | GET | `/api/getUserProfile?username=…` | — |
| Get own profile | GET | `/api/getUserProfile?me=1` | Bearer |
| Update profile | PATCH | `/api/updateUserProfile` | Bearer |
| Delete profile | DELETE | `/api/deleteUserProfile` | Bearer |
| Create recipe log | POST | `/api/recipeLog?action=create` | Bearer |
| Update recipe log | POST | `/api/recipeLog?action=update` | Bearer |
| Delete recipe log | POST | `/api/recipeLog?action=delete` | Bearer |
| User logs | GET | `/api/social?action=userLogs&username=…` | Bearer |
| Login (lookup) | POST | `/api/social?action=login` | — |
| Sign-in email | GET | `/api/social?action=signInEmail&username=…` | — |
| Follow / accept / decline / unfollow | POST | `/api/social?action=…` | Bearer |
| Followers / following / feed | GET | `/api/social?action=…` | Bearer |
| Search users | GET | `/api/social?action=searchUsers&q=…` | — |
| Notifications | GET | `/api/social?action=notifications&username=…` | Bearer |
| AI cache | GET | `/api/aiSuggestions?action=loadCached&username=…` | Bearer |
| AI generate | POST | `/api/aiSuggestions?action=generate` | Bearer |
| AI hide | POST | `/api/aiSuggestions?action=hide` | Bearer |
| Meal plan list | GET | `/api/mealPlan?action=getMealPlan&…` | Bearer |
| Meal plan schedule / move / remove | POST | `/api/mealPlan?action=…` | Bearer |
| Shopping list | GET | `/api/mealPlan?action=shoppingList&…` | Bearer |
