#!/usr/bin/env python3
"""
Local test script for Kitchen Personality Analysis
This version doesn't require Firebase dependencies
"""

import numpy as np
from collections import Counter

class KitchenPersonalityAnalyzer:
    def __init__(self):
        self.cuisine_categories = {
            'italian': ['pasta', 'pizza', 'risotto', 'bruschetta', 'tiramisu'],
            'asian': ['sushi', 'stir-fry', 'curry', 'dumplings', 'ramen'],
            'mexican': ['tacos', 'enchiladas', 'guacamole', 'quesadilla', 'churros'],
            'indian': ['curry', 'naan', 'biryani', 'samosa', 'dal'],
            'french': ['croissant', 'quiche', 'ratatouille', 'coq au vin', 'creme brulee'],
            'mediterranean': ['hummus', 'falafel', 'paella', 'tzatziki', 'baklava'],
            'american': ['burger', 'bbq', 'apple pie', 'mac and cheese', 'chicken wings'],
            'japanese': ['sushi', 'ramen', 'tempura', 'miso soup', 'takoyaki'],
            'thai': ['pad thai', 'tom yum', 'green curry', 'mango sticky rice'],
            'greek': ['moussaka', 'souvlaki', 'spanakopita', 'baklava'],
            'indonesian': ['nasi goreng', 'satay', 'rendang', 'gado-gado'],
            'vietnamese': ['pho', 'banh mi', 'spring rolls', 'bun cha'],
            'korean': ['bibimbap', 'bulgogi', 'kimchi', 'tteokbokki'],
            'lebanese': ['tabbouleh', 'kibbeh', 'shawarma', 'baklava'],
            'moroccan': ['tagine', 'couscous', 'harira', 'pastilla'],
            'turkish': ['kebab', 'lahmacun', 'borek', 'baklava'],
            'persian': ['kabob', 'ghormeh sabzi', 'tahchin', 'shirin polo'],
            'ethiopian': ['injera', 'doro wat', 'misir wat', 'kitfo'],
            'caribbean': ['jerk chicken', 'rice and peas', 'plantains', 'ackee'],
            'african': ['jollof rice', 'fufu', 'egusi soup', 'suya']
        }
        
        self.difficulty_weights = {'easy': 1, 'medium': 2, 'hard': 3}
        self.rating_weights = {1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1.0}
        
    def analyze_user_personality(self, user_id):
        """Main function to analyze user's kitchen personality"""
        try:
            # Get user's recipe history (simulated for local testing)
            recipes = self._get_sample_recipes()
            
            if not recipes:
                return self._get_default_personality()
            
            # Analyze different aspects
            cuisine_analysis = self._analyze_cuisine_preferences(recipes)
            cooking_style = self._analyze_cooking_style(recipes)
            ingredient_preferences = self._analyze_ingredient_preferences(recipes)
            cooking_patterns = self._analyze_cooking_patterns(recipes)
            
            # Generate personality traits
            primary_trait = self._determine_primary_trait(cuisine_analysis, cooking_style, cooking_patterns)
            secondary_traits = self._determine_secondary_traits(cuisine_analysis, cooking_style, ingredient_preferences)
            
            # Calculate scores
            experimental_score = self._calculate_experimental_score(cuisine_analysis, cooking_style)
            comfort_score = self._calculate_comfort_score(cooking_patterns, cuisine_analysis)
            skill_level = self._determine_skill_level(cooking_style, cooking_patterns)
            
            # Build personality object
            personality = {
                'primary_trait': primary_trait,
                'secondary_traits': secondary_traits,
                'top_cuisines': cuisine_analysis['top_cuisines'][:3],
                'favorite_ingredients': ingredient_preferences['top_ingredients'][:5],
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
                }
            }
            
            return personality
            
        except Exception as e:
            print(f"Error analyzing personality: {str(e)}")
            return self._get_default_personality()
    
    def _get_sample_recipes(self):
        """Get sample recipes for local testing"""
        return [
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
            },
            {
                'title': 'Chicken Tikka Masala',
                'cuisines': ['indian'],
                'ingredients': ['chicken', 'yogurt', 'spices', 'tomato sauce', 'cream'],
                'rating': 5,
                'difficulty': 'medium',
                'cooking_time': 50,
                'source': 'Cookbook',
                'notes': 'Creamy Indian curry'
            },
            {
                'title': 'Beef Stir Fry',
                'cuisines': ['asian'],
                'ingredients': ['beef', 'broccoli', 'soy sauce', 'ginger', 'garlic'],
                'rating': 3,
                'difficulty': 'easy',
                'cooking_time': 20,
                'source': 'Online recipe',
                'notes': 'Quick weeknight dinner'
            }
        ]
    
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
        
        # Calculate diversity score (0-1, higher = more diverse)
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
        
        avg_difficulty = np.mean(difficulties) if difficulties else 2.0
        avg_rating = np.mean(ratings) if ratings else 3.0
        
        # Determine style preference
        if avg_difficulty > 2.5:
            style = 'adventurous'
        elif avg_difficulty < 1.5:
            style = 'comfort-focused'
        else:
            style = 'balanced'
        
        return {
            'avg_difficulty': avg_difficulty,
            'avg_rating': avg_rating,
            'style_preference': style,
            'difficulty_distribution': Counter([r.get('difficulty', 'medium') for r in recipes])
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
        
        # Calculate time-based patterns
        cooking_times = [r.get('cooking_time', 30) for r in recipes if r.get('cooking_time')]
        ratings = [r.get('rating', 0) for r in recipes if r.get('rating', 0) > 0]
        
        avg_cooking_time = np.mean(cooking_times) if cooking_times else 30
        avg_rating = np.mean(ratings) if ratings else 3.0
        
        # Determine frequency category
        total_recipes = len(recipes)
        if total_recipes >= 20:
            frequency = 'frequent_cook'
        elif total_recipes >= 10:
            frequency = 'regular_cook'
        elif total_recipes >= 5:
            frequency = 'occasional_cook'
        else:
            frequency = 'new_cook'
        
        return {
            'frequency_category': frequency,
            'avg_rating': avg_rating,
            'avg_cooking_time': avg_cooking_time,
            'total_recipes': total_recipes
        }
    
    def _determine_primary_trait(self, cuisine_analysis, cooking_style, cooking_patterns):
        """Determine the primary personality trait"""
        traits = []
        
        # Cuisine-based traits
        if cuisine_analysis['diversity_score'] > 0.7:
            traits.append('Global Explorer')
        elif cuisine_analysis['total_cuisines'] > 8:
            traits.append('Cuisine Adventurer')
        
        # Difficulty-based traits
        if cooking_style['avg_difficulty'] > 2.5:
            traits.append('Challenge Seeker')
        elif cooking_style['avg_difficulty'] < 1.5:
            traits.append('Comfort Specialist')
        
        # Rating-based traits
        if cooking_style['avg_rating'] > 4.5:
            traits.append('Perfectionist')
        elif cooking_style['avg_rating'] < 3.0:
            traits.append('Learning Chef')
        
        # Frequency-based traits
        if cooking_patterns['frequency_category'] == 'frequent_cook':
            traits.append('Dedicated Chef')
        elif cooking_patterns['frequency_category'] == 'new_cook':
            traits.append('Kitchen Newcomer')
        
        # Time-based traits
        if cooking_patterns['avg_cooking_time'] < 25:
            traits.append('Quick Cook')
        elif cooking_patterns['avg_cooking_time'] > 60:
            traits.append('Slow Food Enthusiast')
        
        return traits[0] if traits else 'Balanced Cook'
    
    def _determine_secondary_traits(self, cuisine_analysis, cooking_style, ingredient_preferences):
        """Determine secondary personality traits"""
        traits = []
        
        # Ingredient exploration
        if ingredient_preferences['total_unique_ingredients'] > 30:
            traits.append('Ingredient Explorer')
        
        # Cuisine specialization
        if cuisine_analysis['diversity_score'] < 0.3:
            traits.append('Cuisine Specialist')
        
        # Cooking time preference
        if cooking_style['style_preference'] == 'adventurous':
            traits.append('Risk Taker')
        
        # Rating consistency
        if cooking_style['avg_rating'] > 4.0:
            traits.append('Quality Focused')
        
        return traits[:3]  # Return top 3 secondary traits
    
    def _calculate_experimental_score(self, cuisine_analysis, cooking_style):
        """Calculate how experimental the user is (0-1)"""
        score = 0.0
        
        # Cuisine diversity (40% weight)
        score += cuisine_analysis['diversity_score'] * 0.4
        
        # Difficulty preference (30% weight)
        difficulty_score = min(1.0, (cooking_style['avg_difficulty'] - 1) / 2)
        score += difficulty_score * 0.3
        
        # Cuisine variety (30% weight)
        variety_score = min(1.0, cuisine_analysis['total_cuisines'] / 15)
        score += variety_score * 0.3
        
        return min(1.0, score)
    
    def _calculate_comfort_score(self, cooking_patterns, cuisine_analysis):
        """Calculate comfort level (0-1)"""
        score = 0.0
        
        # Recipe count (30% weight)
        count_score = min(1.0, cooking_patterns['total_recipes'] / 20)
        score += count_score * 0.3
        
        # Rating consistency (40% weight)
        rating_score = cooking_patterns['avg_rating'] / 5.0
        score += rating_score * 0.4
        
        # Cuisine familiarity (30% weight)
        familiarity_score = 1.0 - cuisine_analysis['diversity_score']
        score += familiarity_score * 0.3
        
        return min(1.0, score)
    
    def _determine_skill_level(self, cooking_style, cooking_patterns):
        """Determine overall skill level"""
        if cooking_patterns['total_recipes'] >= 25 and cooking_style['avg_rating'] >= 4.0:
            return 'expert'
        elif cooking_patterns['total_recipes'] >= 15 and cooking_style['avg_rating'] >= 3.5:
            return 'advanced'
        elif cooking_patterns['total_recipes'] >= 8 and cooking_style['avg_rating'] >= 3.0:
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
            }
        }

def test_personality_analysis():
    """Test the kitchen personality analysis with sample data"""
    
    # Create analyzer instance
    analyzer = KitchenPersonalityAnalyzer()
    
    print("🍳 Kitchen Personality Analysis Test (Local Version)")
    print("=" * 60)
    
    # Test default personality (no recipes)
    print("\n1. Testing Default Personality (New User):")
    default_personality = analyzer._get_default_personality()
    print(f"   Primary Trait: {default_personality['primary_trait']}")
    print(f"   Secondary Traits: {', '.join(default_personality['secondary_traits'])}")
    print(f"   Skill Level: {default_personality['skill_level']}")
    
    # Test personality trait determination
    print("\n2. Testing Trait Determination:")
    
    # Analyze sample data
    cuisine_analysis = analyzer._analyze_cuisine_preferences(analyzer._get_sample_recipes())
    cooking_style = analyzer._analyze_cooking_style(analyzer._get_sample_recipes())
    ingredient_preferences = analyzer._analyze_ingredient_preferences(analyzer._get_sample_recipes())
    cooking_patterns = analyzer._analyze_cooking_patterns(analyzer._get_sample_recipes())
    
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
            'total_recipes': len(analyzer._get_sample_recipes()),
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
