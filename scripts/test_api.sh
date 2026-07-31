#!/bin/bash

# ==========================================
# Nourishare API Test Script
# ==========================================
# Runnable smoke test of live Vercel API endpoints.
# Override the base URL with: BASE_URL=https://your-deploy.vercel.app ./scripts/test_api.sh
# Override fixture users with: TEST_USERNAME=... TEST_USERNAME_2=... ./scripts/test_api.sh
# Protected calls need a Firebase ID token: ID_TOKEN=... ./scripts/test_api.sh
#
# Accepting a follow request as TEST_USERNAME_2 needs that user's token:
#   ID_TOKEN_2=... ./scripts/test_api.sh
#
# NOTE: Social + login live under /api/social?action=…
# Recipe CRUD lives under /api/recipeLog?action=create|update|delete
# AI lives under /api/aiSuggestions?action=loadCached|generate|hide
# Meal plan lives under /api/mealPlan?action=…

BASE_URL="${BASE_URL:-https://nourishare.vercel.app}"
ID_TOKEN="${ID_TOKEN:-YOUR_ID_TOKEN}"
ID_TOKEN_2="${ID_TOKEN_2:-${ID_TOKEN}}"
TEST_USERNAME="${TEST_USERNAME:-roshan}"
TEST_USERNAME_2="${TEST_USERNAME_2:-emily}"
TEST_EMAIL="${TEST_EMAIL:-${TEST_USERNAME}@email.com}"
TEST_EMAIL_2="${TEST_EMAIL_2:-${TEST_USERNAME_2}@email.com}"
AUTH_HEADER=(-H "Authorization: Bearer ${ID_TOKEN}")
AUTH_HEADER_2=(-H "Authorization: Bearer ${ID_TOKEN_2}")

echo "=========================================="
echo "Nourishare API Test"
echo "Using base URL: ${BASE_URL}"
echo "Test users: ${TEST_USERNAME}, ${TEST_USERNAME_2}"
echo "=========================================="

# ==========================================
# 1. USER PROFILE FEATURES
# ==========================================
echo ""
echo "1. USER PROFILE FEATURES"
echo "----------------------------------------"

echo ""
echo "1.1 Create User Profile (${TEST_USERNAME})"
curl -X POST "${BASE_URL}/api/createUserProfile" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "{
    \"username\": \"${TEST_USERNAME}\",
    \"firstName\": \"Roshan\",
    \"lastName\": \"Paul\",
    \"email\": \"${TEST_EMAIL}\",
    \"bio\": \"Food enthusiast and home cook\",
    \"acceptedTermsAt\": \"2026-07-24T00:00:00.000Z\",
    \"acceptedTermsVersion\": \"2026-07-23\"
  }"

echo ""
echo ""
echo "1.2 Create User Profile (${TEST_USERNAME_2})"
echo "Note: needs ID_TOKEN_2 for ${TEST_USERNAME_2}'s Firebase account."
curl -X POST "${BASE_URL}/api/createUserProfile" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER_2[@]}" \
  -d "{
    \"username\": \"${TEST_USERNAME_2}\",
    \"firstName\": \"Emily\",
    \"lastName\": \"Chen\",
    \"email\": \"${TEST_EMAIL_2}\",
    \"bio\": \"Home cook and noodle lover\",
    \"acceptedTermsAt\": \"2026-07-24T00:00:00.000Z\",
    \"acceptedTermsVersion\": \"2026-07-23\"
  }"

echo ""
echo ""
echo "1.3 Log In User by username (POST /api/social?action=login)"
curl -X POST "${BASE_URL}/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${TEST_USERNAME}\"}"

echo ""
echo ""
echo "1.4 Log In User by email (POST /api/social?action=login)"
curl -X POST "${BASE_URL}/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${TEST_EMAIL_2}\"}"

echo ""
echo ""
echo "1.4b Username → email for Firebase sign-in (GET /api/social?action=signInEmail)"
curl -X GET "${BASE_URL}/api/social?action=signInEmail&username=${TEST_USERNAME}"

echo ""
echo ""
echo "1.5 Get User Profile (${TEST_USERNAME})"
curl -X GET "${BASE_URL}/api/getUserProfile?username=${TEST_USERNAME}"

echo ""
echo ""
echo "1.6 Update User Profile (${TEST_USERNAME})"
curl -X PATCH "${BASE_URL}/api/updateUserProfile" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "{
    \"username\": \"${TEST_USERNAME}\",
    \"bio\": \"Updated bio: Food enthusiast and experimental chef\",
    \"kitchen_personality\": {
      \"top_cuisines\": [\"Mediterranean\", \"Italian\", \"Chinese\"]
    }
  }"

echo ""
echo ""
echo "1.7 Delete User Profile (cleanup - optional; requires matching token)"
echo "curl -X DELETE \"${BASE_URL}/api/deleteUserProfile\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer \${ID_TOKEN}\" -d '{\"username\": \"${TEST_USERNAME}\"}'"

echo ""
echo ""

# ==========================================
# 2. RECIPE LOGGING FEATURES
# ==========================================
echo "2. RECIPE LOGGING FEATURES"
echo "----------------------------------------"

echo ""
echo "2.1 Create Recipe Log (${TEST_USERNAME} - Pasta)"
curl -X POST "${BASE_URL}/api/recipeLog?action=create" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "{
    \"username\": \"${TEST_USERNAME}\",
    \"title\": \"Creamy Garlic Pasta\",
    \"ingredients\": \"pasta, garlic, cream, parmesan, basil\",
    \"notes\": \"Delicious and creamy! Added extra garlic.\",
    \"rating\": 5,
    \"difficulty\": \"easy\",
    \"time\": \"30 minutes\",
    \"recipeLink\": \"https://cooking.nytimes.com/recipes/pasta\"
  }"

echo ""
echo ""
echo "2.2 Create Recipe Log (${TEST_USERNAME} - Curry)"
curl -X POST "${BASE_URL}/api/recipeLog?action=create" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "{
    \"username\": \"${TEST_USERNAME}\",
    \"title\": \"Thai Green Curry\",
    \"ingredients\": \"chicken, coconut milk, green curry paste, basil, rice\",
    \"notes\": \"Spicy and flavorful. Perfect balance of heat.\",
    \"rating\": 4,
    \"difficulty\": \"medium\",
    \"time\": \"45 minutes\",
    \"recipeInstructions\": \"Simmer curry paste with coconut milk; add chicken and basil.\"
  }"

echo ""
echo ""
echo "2.3 Create Recipe Log (${TEST_USERNAME_2} - Ramen)"
curl -X POST "${BASE_URL}/api/recipeLog?action=create" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER_2[@]}" \
  -d "{
    \"username\": \"${TEST_USERNAME_2}\",
    \"title\": \"Tonkotsu Ramen\",
    \"ingredients\": \"ramen noodles, pork broth, chashu, egg, nori\",
    \"notes\": \"Rich and savory broth. Best ramen I've made!\",
    \"rating\": 5,
    \"difficulty\": \"hard\",
    \"time\": \"4 hours\",
    \"recipeLink\": \"https://example.com/tonkotsu\"
  }"

echo ""
echo ""
echo "2.4 Get All Recipe Logs for ${TEST_USERNAME}"
curl -X GET "${BASE_URL}/api/social?action=userLogs&username=${TEST_USERNAME}" \
  "${AUTH_HEADER[@]}"

echo ""
echo ""
echo "2.5 Get All Recipe Logs for ${TEST_USERNAME_2} (viewer must follow, or use ID_TOKEN_2)"
curl -X GET "${BASE_URL}/api/social?action=userLogs&username=${TEST_USERNAME_2}" \
  "${AUTH_HEADER_2[@]}"

echo ""
echo ""
echo "2.6 Update Recipe Log (replace LOG_ID_HERE with an actual logId from step 2.4)"
echo "curl -X POST \"${BASE_URL}/api/recipeLog?action=update\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer \${ID_TOKEN}\" -d '{\"username\": \"${TEST_USERNAME}\", \"logId\": \"LOG_ID_HERE\", \"updates\": {\"rating\": 5, \"notes\": \"Updated notes\"}}'"

echo ""
echo ""
echo "2.7 Delete Recipe Log (replace LOG_ID_HERE with an actual logId)"
echo "curl -X POST \"${BASE_URL}/api/recipeLog?action=delete\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer \${ID_TOKEN}\" -d '{\"username\": \"${TEST_USERNAME}\", \"logId\": \"LOG_ID_HERE\"}'"

echo ""
echo ""

# ==========================================
# 3. SOCIAL FEATURES (consolidated /api/social)
# ==========================================
echo "3. SOCIAL FEATURES"
echo "----------------------------------------"
echo "Follow creates a pending request; accept with ${TEST_USERNAME_2}'s token (ID_TOKEN_2)."

echo ""
echo "3.1 Follow User (${TEST_USERNAME} -> ${TEST_USERNAME_2})"
curl -X POST "${BASE_URL}/api/social?action=follow" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "{\"username\": \"${TEST_USERNAME}\", \"targetUsername\": \"${TEST_USERNAME_2}\"}"

echo ""
echo ""
echo "3.2 Accept Follow Request (${TEST_USERNAME_2} accepts ${TEST_USERNAME})"
curl -X POST "${BASE_URL}/api/social?action=acceptFollowRequest" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER_2[@]}" \
  -d "{\"username\": \"${TEST_USERNAME_2}\", \"fromUsername\": \"${TEST_USERNAME}\"}"

echo ""
echo ""
echo "3.3 Get Followers (${TEST_USERNAME_2})"
curl -X GET "${BASE_URL}/api/social?action=followers&username=${TEST_USERNAME_2}" \
  "${AUTH_HEADER[@]}"

echo ""
echo ""
echo "3.4 Get Following (${TEST_USERNAME})"
curl -X GET "${BASE_URL}/api/social?action=following&username=${TEST_USERNAME}" \
  "${AUTH_HEADER[@]}"

echo ""
echo ""
echo "3.5 Get Social Feed (${TEST_USERNAME})"
curl -X GET "${BASE_URL}/api/social?action=feed&username=${TEST_USERNAME}" \
  "${AUTH_HEADER[@]}"

echo ""
echo ""
echo "3.6 Search Users"
curl -X GET "${BASE_URL}/api/social?action=searchUsers&q=${TEST_USERNAME:0:3}"

echo ""
echo ""
echo "3.7 Unfollow User (${TEST_USERNAME} -> ${TEST_USERNAME_2})"
curl -X POST "${BASE_URL}/api/social?action=unfollow" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "{\"username\": \"${TEST_USERNAME}\", \"targetUsername\": \"${TEST_USERNAME_2}\"}"

echo ""
echo ""

# ==========================================
# 4. AI SUGGESTIONS
# ==========================================
echo "4. AI SUGGESTIONS"
echo "----------------------------------------"
echo "Client path is /api/aiSuggestions?action=… (not /api/getSuggestions)."

echo ""
echo "4.1 Load cached suggestions (${TEST_USERNAME})"
curl -X GET "${BASE_URL}/api/aiSuggestions?action=loadCached&username=${TEST_USERNAME}" \
  "${AUTH_HEADER[@]}"

echo ""
echo ""
echo "4.2 Generate suggestions (${TEST_USERNAME}) — counts against daily quota"
curl -X POST "${BASE_URL}/api/aiSuggestions?action=generate" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "{\"username\": \"${TEST_USERNAME}\", \"pantry_ingredients\": [\"eggs\", \"spinach\"]}"

echo ""
echo ""

# ==========================================
# 5. MEAL PLAN
# ==========================================
echo "5. MEAL PLAN"
echo "----------------------------------------"

START_DATE="${START_DATE:-2026-07-27}"
END_DATE="${END_DATE:-2026-08-02}"

echo ""
echo "5.1 Get meal plan (${TEST_USERNAME})"
curl -X GET "${BASE_URL}/api/mealPlan?action=getMealPlan&username=${TEST_USERNAME}&startDate=${START_DATE}&endDate=${END_DATE}" \
  "${AUTH_HEADER[@]}"

echo ""
echo ""
echo "5.2 Shopping list (${TEST_USERNAME})"
curl -X GET "${BASE_URL}/api/mealPlan?action=shoppingList&username=${TEST_USERNAME}&startDate=${START_DATE}&endDate=${END_DATE}" \
  "${AUTH_HEADER[@]}"

echo ""
echo ""
echo "=========================================="
echo "END OF API TESTS"
echo "=========================================="
echo "Skipped (internal-only, need x-internal-secret): /api/getSuggestions, /api/analyzePersonality"
