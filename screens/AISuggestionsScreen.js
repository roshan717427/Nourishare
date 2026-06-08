import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useNextUp } from '../context/NextUpContext';
import { API_URL } from '../config/api';
import { colors, radii } from '../constants/theme';

// Image fallbacks only — not shown as demo recipe cards.
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80',
  'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80',
  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80',
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
  'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&q=80',
  'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=500&q=80',
];

function RecipeCard({ recipe, onPress, onAddPress, isInNextUp, accentColor }) {
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.recipeImageWrap}>
        <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={styles.recipeImageGradient}
        />
        <TouchableOpacity
          style={[styles.addButton, isInNextUp && styles.addButtonActive]}
          onPress={(e) => {
            e?.stopPropagation?.();
            onAddPress?.();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isInNextUp ? 'Already in Next Up' : 'Add to Next Up'}
        >
          <Ionicons
            name={isInNextUp ? 'checkmark' : 'add'}
            size={18}
            color={isInNextUp ? colors.card : colors.primary}
          />
        </TouchableOpacity>
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

function SectionEmptyState({ icon, title, hint, accentColor, chipColors }) {
  return (
    <View style={styles.sectionEmpty}>
      <LinearGradient colors={chipColors} style={styles.sectionEmptyIcon}>
        <Ionicons name={icon} size={28} color={accentColor} />
      </LinearGradient>
      <Text style={styles.sectionEmptyTitle}>{title}</Text>
      <Text style={styles.sectionEmptyHint}>{hint}</Text>
    </View>
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

function mapApiSuggestions(items, imageOffset = 0) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((s, index) => ({
    ...s,
    id: s.id || s.recipe_id || `s-${imageOffset + index}`,
    name: s.name || s.recipe_name || 'Recipe',
    subtitle: s.subtitle || formatSubtitle(s),
    image:
      s.image ||
      FALLBACK_IMAGES[(imageOffset + index) % FALLBACK_IMAGES.length],
    ingredients: s.ingredients,
    steps: s.steps || undefined,
    difficulty_level: s.difficulty_level || s.difficulty,
    cooking_time: s.cooking_time || s.time,
  }));
}

function buildGreeting(displayName, hasLogs, hasFollowing) {
  if (!hasLogs && !hasFollowing) {
    return `Hey ${displayName}! Log a few meals and follow friends, and we'll start picking recipes just for you.`;
  }
  if (!hasLogs) {
    return `Hey ${displayName}! Follow friends to see what they're cooking. Log your own meals too so we can learn your tastes.`;
  }
  if (!hasFollowing) {
    return `Hey ${displayName}! Here are picks based on what you've been cooking. Follow friends to unlock more inspiration.`;
  }
  return `Hey ${displayName}! Here are recipes picked from your tastes and what your friends have been cooking lately.`;
}

export default function AISuggestionsScreen({ navigation }) {
  const { user, following } = useAuth();
  const { addToNextUp, isInNextUp } = useNextUp();
  const username = user?.username || 'current_user';
  const displayName = user?.name || username;
  const hasFollowing = following.length > 0;

  const [loading, setLoading] = useState(true);
  const [hasLogs, setHasLogs] = useState(false);
  const [preferenceSuggestions, setPreferenceSuggestions] = useState([]);
  const [friendSuggestions, setFriendSuggestions] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchSuggestions = async () => {
        setLoading(true);

        let logsCount = 0;
        try {
          const logsResponse = await fetch(
            `${API_URL}/social?action=userLogs&username=${encodeURIComponent(username)}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
          );
          if (logsResponse.ok) {
            const logsData = await logsResponse.json();
            logsCount = Array.isArray(logsData.logs) ? logsData.logs.length : 0;
          }
        } catch (err) {
          console.log('Could not load user logs for suggestions:', err.message);
        }

        try {
          const response = await fetch(`${API_URL}/getSuggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, limit: 6 }),
          });

          if (!isMounted) {
            return;
          }

          if (!response.ok) {
            setHasLogs(logsCount > 0);
            setPreferenceSuggestions([]);
            setFriendSuggestions([]);
            return;
          }

          const data = await response.json();
          const userHasLogs = data.has_logs ?? logsCount > 0;
          setHasLogs(userHasLogs);

          const preferenceItems = userHasLogs
            ? data.preference_suggestions || []
            : [];
          const friendItems =
            hasFollowing && (data.friend_suggestions?.length
              ? data.friend_suggestions
              : data.suggestions || []);

          setPreferenceSuggestions(mapApiSuggestions(preferenceItems, 0));
          setFriendSuggestions(mapApiSuggestions(friendItems, 3));
        } catch (err) {
          console.log('Suggestions API unavailable:', err.message);
          if (isMounted) {
            setHasLogs(logsCount > 0);
            setPreferenceSuggestions([]);
            setFriendSuggestions([]);
          }
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
    }, [username, hasFollowing])
  );

  const openRecipe = (recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  const handleAddToNextUp = (recipe) => {
    if (isInNextUp(recipe.id)) {
      Alert.alert('Already in Next Up', `"${recipe.name}" is already on your list.`);
      return;
    }
    const added = addToNextUp(recipe);
    if (added) {
      Alert.alert('Saved to Next Up', `"${recipe.name}" is on your private cooking queue.`);
    }
  };

  const showPreferenceEmpty = !loading && !hasLogs;
  const showPreferenceLearning =
    !loading && hasLogs && preferenceSuggestions.length === 0;
  const showFriendEmpty = !loading && (!hasFollowing || friendSuggestions.length === 0);

  const preferenceEmptyCopy = {
    title: 'Nothing to suggest yet',
    hint: 'Log your first meal and we will start picking recipes for you.',
  };

  const friendEmptyCopy = !hasFollowing
    ? {
        title: 'No friend picks yet',
        hint: 'Follow friends to see what they\'re cooking.',
      }
    : {
        title: 'Friends are quiet for now',
        hint: 'When they post recipes, inspiration will show up here.',
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
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
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
            {buildGreeting(displayName, hasLogs, hasFollowing)}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : null}

        <View style={styles.sectionHeader}>
          <Ionicons name="heart" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Based on Your Preferences</Text>
        </View>
        {showPreferenceEmpty ? (
          <SectionEmptyState
            icon="restaurant-outline"
            title={preferenceEmptyCopy.title}
            hint={preferenceEmptyCopy.hint}
            accentColor={colors.primary}
            chipColors={[colors.chipCoral, colors.chipAmber]}
          />
        ) : showPreferenceLearning ? (
          <SectionEmptyState
            icon="restaurant-outline"
            title="Still learning your tastes"
            hint="Keep logging meals, and we will sharpen these picks as we go."
            accentColor={colors.primary}
            chipColors={[colors.chipCoral, colors.chipAmber]}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardRow}
          >
            {preferenceSuggestions.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                accentColor={colors.primary}
                isInNextUp={isInNextUp(recipe.id)}
                onAddPress={() => handleAddToNextUp(recipe)}
                onPress={() => openRecipe(recipe)}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={18} color={colors.accent} />
          <Text style={styles.sectionTitle}>Inspired by Your Friends</Text>
        </View>
        {showFriendEmpty ? (
          <SectionEmptyState
            icon="people-outline"
            title={friendEmptyCopy.title}
            hint={friendEmptyCopy.hint}
            accentColor={colors.accent}
            chipColors={[colors.chipTeal, colors.chipBlue]}
          />
        ) : (
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
                isInNextUp={isInNextUp(recipe.id)}
                onAddPress={() => handleAddToNextUp(recipe)}
                onPress={() => openRecipe(recipe)}
              />
            ))}
          </ScrollView>
        )}
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
  sectionEmpty: {
    marginHorizontal: 20,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  sectionEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sectionEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  sectionEmptyHint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
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
  addButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  addButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
