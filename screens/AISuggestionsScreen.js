import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { colors, radii } from '../constants/theme';

const PREFERENCE_SUGGESTIONS = [
  {
    id: 'p1',
    name: 'Creamy Tomato Pasta',
    subtitle: 'Easy, 30 min',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80',
    difficulty_level: 'easy',
    cooking_time: '30 min',
    rating: 4.8,
    ingredients: 'Pasta, canned tomatoes, garlic, heavy cream, parmesan, basil, olive oil, salt, black pepper',
    cooking_notes:
      'A silky weeknight pasta with bright tomato flavor and a luxurious cream finish.',
    steps: [
      'Bring a large pot of salted water to a rolling boil. Add 12 oz pasta and cook until al dente, about 9–11 minutes. Reserve 1 cup pasta water, then drain.',
      "While the pasta cooks, warm 2 tbsp olive oil in a wide skillet over medium heat. Add 4 minced garlic cloves and sauté 30 seconds until fragrant — don't let them brown.",
      'Pour in one 14-oz can crushed tomatoes, ½ tsp salt, and a pinch of red pepper flakes. Simmer 8–10 minutes, stirring occasionally, until the sauce thickens slightly.',
      'Lower the heat and stir in ½ cup heavy cream and 2 tbsp grated parmesan. Swirl until smooth and blush-pink. Taste and adjust seasoning.',
      'Add the drained pasta directly to the skillet. Toss, splashing in reserved pasta water a tablespoon at a time, until the sauce coats every strand.',
      'Remove from heat, tear in a handful of fresh basil, and finish with another tbsp parmesan and a drizzle of olive oil.',
      'Serve immediately in warm bowls with extra basil and parmesan on top.',
    ],
  },
  {
    id: 'p2',
    name: 'Mediterranean Quinoa Salad',
    subtitle: 'Healthy, 20 min',
    image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80',
    difficulty_level: 'easy',
    cooking_time: '20 min',
    rating: 4.6,
    ingredients: 'Quinoa, cucumber, cherry tomatoes, red onion, feta, kalamata olives, lemon, olive oil, parsley, salt',
    cooking_notes:
      'A bright, meal-prep-friendly bowl packed with crunch and tangy feta.',
    steps: [
      'Rinse 1 cup quinoa under cold water. Combine with 2 cups water and a pinch of salt in a saucepan; bring to a boil, cover, and simmer 15 minutes until fluffy. Spread on a tray to cool.',
      'Dice 1 cucumber and halve 1 cup cherry tomatoes. Thinly slice ¼ red onion and soak in cold water 5 minutes to mellow the bite, then drain.',
      'Crumble 4 oz feta and roughly chop ½ cup kalamata olives and a handful of fresh parsley.',
      'Whisk the dressing: 3 tbsp olive oil, juice of 1 lemon, ½ tsp salt, and freshly cracked pepper.',
      'In a large bowl, combine cooled quinoa, vegetables, feta, olives, and parsley.',
      'Pour the dressing over the salad and toss gently so the feta stays in chunky pieces.',
      'Chill 15 minutes for flavors to meld, or serve right away with lemon wedges.',
    ],
  },
  {
    id: 'p3',
    name: 'Spicy Ramen Bowl',
    subtitle: 'Comforting, 35 min',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
    difficulty_level: 'medium',
    cooking_time: '35 min',
    rating: 4.7,
    ingredients: 'Ramen noodles, chicken broth, white miso, chili oil, soft-boiled eggs, scallions, shiitake mushrooms, soy sauce, ginger',
    cooking_notes:
      'Deeply savory broth with a gentle chili kick — restaurant-quality comfort in one bowl.',
    steps: [
      'Soft-boil 2 eggs: simmer 6½ minutes, then transfer to an ice bath. Peel and halve when cool.',
      'Slice 4 oz shiitake mushrooms and 3 scallions (keep white and green parts separate). Mince 1 tsp fresh ginger.',
      'In a pot, bring 4 cups chicken broth to a gentle simmer with ginger and scallion whites. Cook 5 minutes to infuse.',
      'Whisk 2 tbsp white miso with a ladle of hot broth until smooth, then stir back into the pot — never boil miso or it loses aroma.',
      'Add mushrooms and simmer 4 minutes until tender. Season with 1 tsp soy sauce and 1–2 tsp chili oil to taste.',
      'Cook ramen noodles in a separate pot according to package directions. Drain and divide between two deep bowls.',
      'Ladle the hot broth and mushrooms over the noodles. Top each bowl with a halved egg, sliced scallion greens, and an extra drizzle of chili oil.',
    ],
  },
];

const FRIEND_SUGGESTIONS = [
  {
    id: 'f1',
    name: 'Homemade Margherita Pizza',
    subtitle: 'Fun, 1 hr',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
    difficulty_level: 'medium',
    cooking_time: '1 hr',
    rating: 4.9,
    ingredients: 'Pizza dough, San Marzano tomatoes, fresh mozzarella, fresh basil, olive oil, garlic, salt, semolina flour',
    cooking_notes:
      'Crisp-chewy crust, sweet tomato sauce, and molten mozzarella — the classic done right.',
    steps: [
      'Place a pizza stone or inverted baking sheet on the middle oven rack and preheat to 500°F (260°C) for at least 30 minutes.',
      'Crush one 14-oz can San Marzano tomatoes by hand. Stir in 1 minced garlic clove, 2 tbsp olive oil, and ½ tsp salt. No cooking needed — the oven will bake the sauce.',
      'On a floured surface, stretch 1 lb pizza dough into a 12-inch round, leaving a slightly thicker rim for the crust.',
      'Transfer to a peel or parchment dusted with semolina. Spread a thin layer of sauce, leaving a ¾-inch border.',
      'Tear 8 oz fresh mozzarella into pieces and distribute evenly. Drizzle lightly with olive oil.',
      'Slide onto the hot stone and bake 8–10 minutes until the crust is spotted brown and cheese bubbles with golden edges.',
      'Rest 1 minute, then shower with fresh basil leaves, a pinch of salt, and a final drizzle of olive oil before slicing.',
    ],
  },
  {
    id: 'f2',
    name: 'Street-Style Fish Tacos',
    subtitle: 'Fresh, 40 min',
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
    difficulty_level: 'easy',
    cooking_time: '40 min',
    rating: 4.5,
    ingredients: 'White fish, corn tortillas, cabbage, lime, sour cream, cilantro, cumin, chili powder, avocado, hot sauce',
    cooking_notes:
      'Crispy-edged fish, crunchy slaw, and creamy lime — everything great street tacos should be.',
    steps: [
      'Make the slaw: toss 2 cups shredded cabbage with juice of 1 lime, ½ tsp salt, and a pinch of sugar. Set aside to soften 10 minutes.',
      'Stir together lime crema — ¼ cup sour cream, zest and juice of ½ lime, and 1 tbsp chopped cilantro.',
      'Pat 1 lb white fish fillets dry. Season with 1 tsp cumin, ½ tsp chili powder, salt, and pepper.',
      'Heat 2 tbsp oil in a cast-iron skillet over medium-high. Sear fish 3–4 minutes per side until golden and flaky. Break into chunks.',
      'Warm 8 corn tortillas in a dry skillet 20 seconds per side, or over a gas flame for light char.',
      'Build each taco: pile fish, drained slaw, crema, avocado slices, cilantro, and hot sauce.',
      'Serve immediately with lime wedges and extra hot sauce on the side.',
    ],
  },
  {
    id: 'f3',
    name: 'Coconut Curry',
    subtitle: 'Flavorful, 45 min',
    image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
    difficulty_level: 'medium',
    cooking_time: '45 min',
    rating: 4.8,
    ingredients: 'Coconut milk, red curry paste, bell pepper, zucchini, tofu, ginger, garlic, fish sauce, jasmine rice, lime, basil',
    cooking_notes:
      'Fragrant, creamy curry with enough vegetables to make it a complete dinner.',
    steps: [
      'Start jasmine rice: rinse 1 cup rice, cook with 1½ cups water until tender, and keep warm.',
      'Press and cube 12 oz firm tofu. Toss with 1 tbsp oil and a pinch of salt; bake or pan-fry until golden on most sides.',
      'In a wok or deep skillet, warm 1 tbsp oil over medium. Add 2 tbsp red curry paste, 1 tbsp minced ginger, and 2 minced garlic cloves. Fry 1 minute until aromatic.',
      'Pour in one 13.5-oz can coconut milk and ½ cup water. Simmer gently, stirring, for 5 minutes.',
      'Add 1 sliced bell pepper and 1 cubed zucchini. Cook 6–8 minutes until just tender.',
      'Stir in the fried tofu, 1 tsp fish sauce (or soy), and 1 tsp sugar. Simmer 3 more minutes. Squeeze in juice of ½ lime.',
      'Serve over rice, garnished with Thai basil and extra lime wedges.',
    ],
  },
];

function RecipeCard({ recipe, onPress, accentColor }) {
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.recipeImageWrap}>
        <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={styles.recipeImageGradient}
        />
        {recipe.rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color={colors.star} />
            <Text style={styles.ratingText}>{recipe.rating}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.recipeInfo, { borderLeftColor: accentColor }]}>
        <Text style={styles.recipeName} numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text style={styles.recipeSubtitle}>{recipe.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatSubtitle(suggestion) {
  const difficulty = suggestion.difficulty_level
    ? suggestion.difficulty_level.charAt(0).toUpperCase() +
      suggestion.difficulty_level.slice(1)
    : null;
  const time = suggestion.cooking_time || null;
  return [difficulty, time].filter(Boolean).join(', ') || 'Suggested for you';
}

export default function AISuggestionsScreen({ navigation }) {
  const { user } = useAuth();
  const username = user?.username || 'current_user';
  const displayName = user?.name || username;

  const [loading, setLoading] = useState(true);
  const [friendSuggestions, setFriendSuggestions] = useState(FRIEND_SUGGESTIONS);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchSuggestions = async () => {
        try {
          const response = await fetch(`${API_URL}/getSuggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, limit: 6 }),
          });

          if (!response.ok) {
            return;
          }

          const data = await response.json();
          if (
            isMounted &&
            data &&
            Array.isArray(data.suggestions) &&
            data.suggestions.length > 0
          ) {
            const mapped = data.suggestions.map((s, index) => ({
              ...s,
              id: s.recipe_id || `s${index}`,
              name: s.recipe_name || 'Recipe',
              subtitle: formatSubtitle(s),
              image: FRIEND_SUGGESTIONS[index % FRIEND_SUGGESTIONS.length].image,
              // Map API cooking_notes into steps for the detail screen.
              steps: undefined,
            }));
            setFriendSuggestions(mapped);
          }
        } catch (err) {
          console.log('Suggestions API unavailable, using sample data:', err.message);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchSuggestions();
      return () => {
        isMounted = false;
      };
    }, [username])
  );

  const openRecipe = (recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="sparkles" size={22} color="#fff" />
          <Text style={styles.headerTitle}>Munchable AI</Text>
        </View>
        <View style={styles.backButton} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingCard}>
          <Text style={styles.greeting}>
            Hi, {displayName}! I've analyzed your cooking history and your friends'
            activity to suggest recipes you'll love.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : null}

        <View style={styles.sectionHeader}>
          <Ionicons name="heart" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Based on Your Preferences</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRow}
        >
          {PREFERENCE_SUGGESTIONS.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              accentColor={colors.primary}
              onPress={() => openRecipe(recipe)}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={18} color={colors.accent} />
          <Text style={styles.sectionTitle}>Inspired by Your Friends</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRow}
        >
          {friendSuggestions.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              accentColor={colors.accent}
              onPress={() => openRecipe(recipe)}
            />
          ))}
        </ScrollView>
      </ScrollView>

      <BottomNavigation navigation={navigation} activeTab="AI" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  greetingCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  greeting: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  loader: {
    marginVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  cardRow: {
    paddingHorizontal: 20,
  },
  recipeCard: {
    width: 180,
    marginRight: 16,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeImageWrap: {
    position: 'relative',
  },
  recipeImage: {
    width: 180,
    height: 150,
    backgroundColor: colors.borderLight,
  },
  recipeImageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  recipeInfo: {
    padding: 12,
    borderLeftWidth: 4,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  recipeSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
