#!/bin/bash

# ==========================================
# Munchable v4 API Test Script
# ==========================================
# Runnable smoke test of every live Vercel API endpoint.
# Override the base URL with: BASE_URL=https://your-deploy.vercel.app ./scripts/test_api.sh
#
# NOTE: The social + login endpoints are consolidated into a single
# query-param-based function at /api/social (action=follow|unfollow|
# followers|following|feed|login).

BASE_URL="${BASE_URL:-https://munchable-v4.vercel.app}"
# Firebase ID token required for protected endpoints (create/update/delete profile, etc.)
ID_TOKEN="${ID_TOKEN:-YOUR_ID_TOKEN}"

echo "=========================================="
echo "Munchable v4 API Test"
echo "Using base URL: ${BASE_URL}"
echo "=========================================="

# ==========================================
# 1. USER PROFILE FEATURES
# ==========================================
echo ""
echo "1. USER PROFILE FEATURES"
echo "----------------------------------------"

echo ""
echo "1.1 Create User Profile (roshan)"
curl -X POST "${BASE_URL}/api/createUserProfile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  -d '{
    "username": "roshan",
    "firstName": "Roshan",
    "lastName": "Paul",
    "email": "roshan@email.com",
    "bio": "Food enthusiast and home cook",
    "kitchenPersona": "Experimental chef",
    "topDishes": ["Pasta", "Curry", "Ramen"],
    "favoriteIngredients": ["Garlic", "Ginger", "Chili"],
    "cookingStats": {"total_meals": 15, "streak": 5}
  }'

echo ""
echo ""
echo "1.2 Create User Profile (emily)"
curl -X POST "${BASE_URL}/api/createUserProfile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  -d '{
    "username": "emily",
    "firstName": "Emily",
    "lastName": "Chen",
    "email": "emily@email.com",
    "bio": "Home cook and noodle lover",
    "kitchenPersona": "Sweet-toothed experimentalist",
    "topDishes": ["Pasta", "Pho", "Ramen"],
    "favoriteIngredients": ["Basil", "Chocolate", "Garlic"],
    "cookingStats": {"total_meals": 27, "streak": 3}
  }'

echo ""
echo ""
echo "1.3 Log In User by username (POST /api/social?action=login)"
curl -X POST "${BASE_URL}/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan"}'

echo ""
echo ""
echo "1.4 Log In User by email (POST /api/social?action=login)"
curl -X POST "${BASE_URL}/api/social?action=login" \
  -H "Content-Type: application/json" \
  -d '{"email": "emily@email.com"}'

echo ""
echo ""
echo "1.5 Get User Profile (roshan)"
curl -X GET "${BASE_URL}/api/getUserProfile?username=roshan"

echo ""
echo ""
echo "1.6 Update User Profile (roshan)"
curl -X PATCH "${BASE_URL}/api/updateUserProfile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  -d '{
    "username": "roshan",
    "bio": "Updated bio: Food enthusiast and experimental chef",
    "kitchen_personality": {
      "top_cuisines": ["Mediterranean", "Italian", "Chinese"]
    }
  }'

echo ""
echo ""
echo "1.7 Delete User Profile (cleanup - optional)"
echo "curl -X DELETE \"${BASE_URL}/api/deleteUserProfile\" -H \"Content-Type: application/json\" -d '{\"username\": \"roshan\"}'"

echo ""
echo ""

# ==========================================
# 2. RECIPE LOGGING FEATURES
# ==========================================
echo "2. RECIPE LOGGING FEATURES"
echo "----------------------------------------"

echo ""
echo "2.1 Create Recipe Log (roshan - Pasta)"
curl -X POST "${BASE_URL}/api/createRecipeLog" \
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

echo ""
echo ""
echo "2.2 Create Recipe Log (roshan - Curry)"
curl -X POST "${BASE_URL}/api/createRecipeLog" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "roshan",
    "title": "Thai Green Curry",
    "ingredients": ["chicken", "coconut milk", "green curry paste", "basil", "rice"],
    "notes": "Spicy and flavorful. Perfect balance of heat.",
    "rating": 4,
    "difficulty": "medium",
    "time": "45 minutes",
    "source": "Mom'\''s cookbook"
  }'

echo ""
echo ""
echo "2.3 Create Recipe Log (emily - Ramen)"
curl -X POST "${BASE_URL}/api/createRecipeLog" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "emily",
    "title": "Tonkotsu Ramen",
    "ingredients": ["ramen noodles", "pork broth", "chashu", "egg", "nori"],
    "notes": "Rich and savory broth. Best ramen I'\''ve made!",
    "rating": 5,
    "difficulty": "hard",
    "time": "4 hours",
    "source": "TikTok recipe"
  }'

echo ""
echo ""
echo "2.4 Get All Recipe Logs for roshan"
curl -X POST "${BASE_URL}/api/getRecipeLog" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan"}'

echo ""
echo ""
echo "2.5 Get All Recipe Logs for emily"
curl -X POST "${BASE_URL}/api/getRecipeLog" \
  -H "Content-Type: application/json" \
  -d '{"username": "emily"}'

echo ""
echo ""
echo "2.6 Update Recipe Log (replace LOG_ID_HERE with an actual logId from step 2.4)"
echo "curl -X POST \"${BASE_URL}/api/updateRecipeLog\" -H \"Content-Type: application/json\" -d '{\"username\": \"roshan\", \"logId\": \"LOG_ID_HERE\", \"updates\": {\"rating\": 5, \"notes\": \"Updated notes\"}}'"

echo ""
echo ""
echo "2.7 Delete Recipe Log (replace LOG_ID_HERE with an actual logId)"
echo "curl -X POST \"${BASE_URL}/api/deleteRecipeLog\" -H \"Content-Type: application/json\" -d '{\"username\": \"roshan\", \"logId\": \"LOG_ID_HERE\"}'"

echo ""
echo ""

# ==========================================
# 3. KITCHEN PERSONALITY ANALYSIS
# ==========================================
echo "3. KITCHEN PERSONALITY ANALYSIS"
echo "----------------------------------------"

echo ""
echo "3.1 Analyze Kitchen Personality (roshan)"
curl -X POST "${BASE_URL}/api/analyzePersonality" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "roshan"}'

echo ""
echo ""
echo "3.2 Analyze Kitchen Personality (emily)"
curl -X POST "${BASE_URL}/api/analyzePersonality" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "emily"}'

echo ""
echo ""

# ==========================================
# 4. SOCIAL FEATURES (consolidated /api/social)
# ==========================================
echo "4. SOCIAL FEATURES"
echo "----------------------------------------"

echo ""
echo "4.1 Follow User (roshan -> emily)"
curl -X POST "${BASE_URL}/api/social?action=follow" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan", "targetUsername": "emily"}'

echo ""
echo ""
echo "4.2 Get Followers (emily)"
curl -X GET "${BASE_URL}/api/social?action=followers&username=emily"

echo ""
echo ""
echo "4.3 Get Following (roshan)"
curl -X GET "${BASE_URL}/api/social?action=following&username=roshan"

echo ""
echo ""
echo "4.4 Get Social Feed (roshan)"
curl -X GET "${BASE_URL}/api/social?action=feed&username=roshan"

echo ""
echo ""
echo "4.5 Unfollow User (roshan -> emily)"
curl -X POST "${BASE_URL}/api/social?action=unfollow" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan", "targetUsername": "emily"}'

echo ""
echo ""

# ==========================================
# 5. SMART SUGGESTIONS
# ==========================================
echo "5. SMART SUGGESTIONS"
echo "----------------------------------------"
echo "Note: requires users to follow each other (see section 4) for non-empty results."

echo ""
echo "5.1 Get Smart Suggestions (roshan)"
curl -X POST "${BASE_URL}/api/getSuggestions" \
  -H "Content-Type: application/json" \
  -d '{"username": "roshan", "limit": 5}'

echo ""
echo ""
echo "5.2 Get Smart Suggestions (emily)"
curl -X POST "${BASE_URL}/api/getSuggestions" \
  -H "Content-Type: application/json" \
  -d '{"username": "emily", "limit": 5}'

echo ""
echo ""
echo "=========================================="
echo "END OF API TESTS"
echo "=========================================="
