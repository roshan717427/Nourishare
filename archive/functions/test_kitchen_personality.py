#!/usr/bin/env python3
"""
Test script for Kitchen Personality Analysis
This demonstrates how the system analyzes user cooking patterns
"""

from kitchen_personality import KitchenPersonalityAnalyzer

def test_personality_analysis():
    """Test the kitchen personality analysis with sample data"""
    
    # Create analyzer instance
    analyzer = KitchenPersonalityAnalyzer()
    
    # Sample user data for testing
    sample_user_id = "test_user_123"
    
    print("🍳 Kitchen Personality Analysis Test")
    print("=" * 50)
    
    # Test default personality (no recipes)
    print("\n1. Testing Default Personality (New User):")
    default_personality = analyzer._get_default_personality()
    print(f"   Primary Trait: {default_personality['primary_trait']}")
    print(f"   Secondary Traits: {', '.join(default_personality['secondary_traits'])}")
    print(f"   Skill Level: {default_personality['skill_level']}")
    
    # Test personality trait determination
    print("\n2. Testing Trait Determination:")
    
    # Test cuisine analysis
    sample_recipes = [
        {
            'title': 'Spaghetti Carbonara',
            'cuisines': ['italian'],
            'ingredients': ['pasta', 'eggs', 'bacon', 'parmesan'],
            'rating': 4,
            'difficulty': 'medium',
            'cooking_time': 25,
            'source': 'NYT Cooking',
            'notes': 'Classic Italian dish'
        },
        {
            'title': 'Pad Thai',
            'cuisines': ['thai'],
            'ingredients': ['rice noodles', 'shrimp', 'peanuts', 'tamarind'],
            'rating': 5,
            'difficulty': 'hard',
            'cooking_time': 45,
            'source': 'TikTok',
            'notes': 'Authentic Thai street food'
        },
        {
            'title': 'Tacos al Pastor',
            'cuisines': ['mexican'],
            'ingredients': ['pork', 'pineapple', 'corn tortillas', 'cilantro'],
            'rating': 4,
            'difficulty': 'medium',
            'cooking_time': 60,
            'source': 'Mom\'s cookbook',
            'notes': 'Marinated pork tacos'
        }
    ]
    
    # Analyze sample data
    cuisine_analysis = analyzer._analyze_cuisine_preferences(sample_recipes)
    cooking_style = analyzer._analyze_cooking_style(sample_recipes)
    ingredient_preferences = analyzer._analyze_ingredient_preferences(sample_recipes)
    cooking_patterns = analyzer._analyze_cooking_patterns(sample_recipes)
    
    print(f"   Cuisine Analysis:")
    print(f"     - Top Cuisines: {[c[0] for c in cuisine_analysis['top_cuisines']]}")
    print(f"     - Diversity Score: {cuisine_analysis['diversity_score']:.2f}")
    print(f"     - Total Cuisines: {cuisine_analysis['total_cuisines']}")
    
    print(f"   Cooking Style:")
    print(f"     - Average Difficulty: {cooking_style['avg_difficulty']:.2f}")
    print(f"     - Average Rating: {cooking_style['avg_rating']:.2f}")
    print(f"     - Style Preference: {cooking_style['style_preference']}")
    
    print(f"   Ingredient Preferences:")
    print(f"     - Top Ingredients: {[i[0] for i in ingredient_preferences['top_ingredients'][:3]]}")
    print(f"     - Total Unique: {ingredient_preferences['total_unique_ingredients']}")
    
    print(f"   Cooking Patterns:")
    print(f"     - Frequency: {cooking_patterns['frequency_category']}")
    print(f"     - Total Recipes: {cooking_patterns['total_recipes']}")
    print(f"     - Avg Cooking Time: {cooking_patterns['avg_cooking_time']:.1f} minutes")
    
    # Test personality determination
    primary_trait = analyzer._determine_primary_trait(cuisine_analysis, cooking_style, cooking_patterns)
    secondary_traits = analyzer._determine_secondary_traits(cuisine_analysis, cooking_style, ingredient_preferences)
    
    print(f"\n3. Personality Results:")
    print(f"   Primary Trait: {primary_trait}")
    print(f"   Secondary Traits: {', '.join(secondary_traits)}")
    
    # Test score calculations
    experimental_score = analyzer._calculate_experimental_score(cuisine_analysis, cooking_style)
    comfort_score = analyzer._calculate_comfort_score(cooking_patterns, cuisine_analysis)
    skill_level = analyzer._determine_skill_level(cooking_style, cooking_patterns)
    
    print(f"\n4. Calculated Scores:")
    print(f"   Experimental Score: {experimental_score:.2f} (0-1, higher = more experimental)")
    print(f"   Comfort Score: {comfort_score:.2f} (0-1, higher = more comfortable)")
    print(f"   Skill Level: {skill_level}")
    
    print(f"\n5. Sample Personality Output:")
    personality = {
        'primary_trait': primary_trait,
        'secondary_traits': secondary_traits,
        'top_cuisines': [c[0] for c in cuisine_analysis['top_cuisines'][:3]],
        'favorite_ingredients': [i[0] for i in ingredient_preferences['top_ingredients'][:5]],
        'cooking_frequency': cooking_patterns['frequency_category'],
        'experimental_score': round(experimental_score, 2),
        'comfort_score': round(comfort_score, 2),
        'cuisine_diversity': round(cuisine_analysis['diversity_score'], 2),
        'skill_level': skill_level,
        'cooking_stats': {
            'total_recipes': len(sample_recipes),
            'avg_rating': round(cooking_patterns['avg_rating'], 2),
            'avg_difficulty': round(cooking_style['avg_difficulty'], 2),
            'avg_cooking_time': round(cooking_patterns['avg_cooking_time'], 2),
            'unique_cuisines': len(cuisine_analysis['cuisine_counts']),
            'unique_ingredients': len(ingredient_preferences['ingredient_counts'])
        }
    }
    
    for key, value in personality.items():
        if key != 'cooking_stats':
            print(f"   {key}: {value}")
        else:
            print(f"   {key}:")
            for stat_key, stat_value in value.items():
                print(f"     {stat_key}: {stat_value}")
    
    print(f"\n✅ Kitchen Personality Analysis Test Complete!")
    print(f"   This user would be classified as a '{primary_trait}' with {skill_level} skill level.")
    print(f"   They're {experimental_score:.0%} experimental and {comfort_score:.0%} comfortable in the kitchen.")

if __name__ == "__main__":
    test_personality_analysis()
