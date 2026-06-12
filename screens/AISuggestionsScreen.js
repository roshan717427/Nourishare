import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useNextUp } from '../context/NextUpContext';
import { API_URL } from '../config/api';
import { colors, radii, spacing, shadows } from '../constants/theme';
import {
  DEFAULT_FALLBACK_IMAGE,
  resolveSuggestionImage,
  titleFallbackImage,
} from '../utils/suggestionImages';

const CARD_WIDTH = 200;
const IMAGE_HEIGHT = 150;

function formatSuggestionReason(raw) {
  if (!raw) return null;
  const why = `${raw}`.trim();
  if (!why) return null;

  if (/^(it |your friend )/i.test(why)) {
    return why;
  }
  if (/^a great /i.test(why)) {
    return `it is ${why}`;
  }
  if (/^(highly rated|well-?rated|popular recipe|liked by|cooked by|recently cooked)/i.test(why)) {
    if (/^cooked by your friend$/i.test(why)) {
      return 'your friend cooked it';
    }
    if (/^recently cooked$/i.test(why)) {
      return 'your friend cooked it recently';
    }
    return `it is ${why}`;
  }
  if (/^(matches|shares|picked|fits|based on|similar to|uses similar)/i.test(why)) {
    if (/^picked /i.test(why)) {
      return `it was ${why}`;
    }
    if (/^based on /i.test(why)) {
      return `it is ${why}`;
    }
    if (/^(similar to|uses similar)/i.test(why)) {
      return `it ${why}`;
    }
    return `it ${why}`;
  }
  if (/^in the same /i.test(why)) {
    return `it is ${why}`;
  }
  if (/^features /i.test(why)) {
    return `it ${why}`;
  }

  return why;
}

function SectionHeader({ eyebrow, title, icon, accentColor, tintBg }) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconCircle, { backgroundColor: tintBg }]}>
          <Ionicons name={icon} size={20} color={accentColor} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={[styles.sectionEyebrow, { color: accentColor }]}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      <View style={[styles.sectionRule, { backgroundColor: accentColor }]} />
    </View>
  );
}

function MetaChip({ icon, label, tint, textColor }) {
  if (!label) return null;
  return (
    <View style={[styles.metaChip, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={11} color={textColor} />
      <Text style={[styles.metaChipText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function RecipeCard({ recipe, onPress, onAddPress, isInNextUp, accentColor, reasonTint, reasonTextColor, showPantry }) {
  const why = formatSuggestionReason(recipe.why_suggested);
  const difficulty = recipe.difficulty_level
    ? recipe.difficulty_level.charAt(0).toUpperCase() + recipe.difficulty_level.slice(1)
    : null;
  const titleImageUri = titleFallbackImage(recipe.name);
  const [imageUri, setImageUri] = useState(titleImageUri);

  useEffect(() => {
    setImageUri(titleFallbackImage(recipe.name));
  }, [recipe.name]);

  const handleImageError = () => {
    setImageUri((current) => (
      current !== DEFAULT_FALLBACK_IMAGE ? DEFAULT_FALLBACK_IMAGE : current
    ));
  };

  return (
    <TouchableOpacity
      style={[styles.recipeCard, shadows.cardSoft]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.recipeImageWrap}>
        <Image
          source={{ uri: imageUri }}
          style={styles.recipeImage}
          onError={handleImageError}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={styles.recipeImageGradient}
        />
        <TouchableOpacity
          style={[styles.addButton, isInNextUp && styles.addButtonActive, shadows.cardSoft]}
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
            color={isInNextUp ? colors.card : accentColor}
          />
        </TouchableOpacity>
        {recipe.rating ? (
          <View style={[styles.ratingBadge, shadows.cardSoft]}>
            <Ionicons name="star" size={11} color={colors.star} />
            <Text style={styles.ratingText}>{recipe.rating}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.recipeBody}>
        <Text style={styles.recipeName} numberOfLines={2}>
          {recipe.name}
        </Text>

        <View style={styles.metaRow}>
          <MetaChip
            icon="speedometer-outline"
            label={difficulty}
            tint={colors.chipTeal}
            textColor={colors.chipTealText}
          />
          <MetaChip
            icon="time-outline"
            label={recipe.cooking_time}
            tint={colors.chipAmber}
            textColor={colors.chipAmberText}
          />
        </View>

        {why ? (
          <View style={[styles.reasonBox, { backgroundColor: reasonTint }]}>
            <Ionicons name="sparkles" size={12} color={reasonTextColor} style={styles.reasonIcon} />
            <Text style={[styles.reasonText, { color: reasonTextColor }]} numberOfLines={2}>
              Suggested because {why}.
            </Text>
          </View>
        ) : (
          <Text style={styles.recipeSubtitle} numberOfLines={1}>
            {recipe.subtitle}
          </Text>
        )}

        {showPantry && (recipe.ingredientsHave?.length > 0 || recipe.ingredientsNeed?.length > 0) ? (
          <View style={styles.pantryBlock}>
            {recipe.ingredientsHave?.length > 0 ? (
              <Text style={styles.pantryHave} numberOfLines={2}>
                You have: {recipe.ingredientsHave.join(', ')}
              </Text>
            ) : null}
            {recipe.ingredientsNeed?.length > 0 ? (
              <Text style={styles.pantryNeed} numberOfLines={2}>
                You need: {recipe.ingredientsNeed.join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function SkeletonCard({ pulseAnim }) {
  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  return (
    <View style={[styles.recipeCard, styles.skeletonCard]}>
      <Animated.View style={[styles.skeletonImage, { opacity }]} />
      <View style={styles.recipeBody}>
        <Animated.View style={[styles.skeletonLine, styles.skeletonLineTitle, { opacity }]} />
        <Animated.View style={[styles.skeletonLine, styles.skeletonLineShort, { opacity }]} />
        <Animated.View style={[styles.skeletonLine, styles.skeletonLineReason, { opacity }]} />
      </View>
    </View>
  );
}

function SkeletonRow({ pulseAnim }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cardRow}
      scrollEnabled={false}
    >
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={`sk-${i}`} pulseAnim={pulseAnim} />
      ))}
    </ScrollView>
  );
}

function SectionEmptyState({ icon, title, hint, accentColor, chipColors }) {
  return (
    <View style={[styles.sectionEmpty, shadows.cardSoft]}>
      <LinearGradient colors={chipColors} style={styles.sectionEmptyIcon}>
        <Ionicons name={icon} size={30} color={accentColor} />
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
  return [difficulty, time].filter(Boolean).join(' · ') || 'Suggested for you';
}

function mapApiSuggestions(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((s, index) => {
    const name = s.name || s.recipe_name || 'Recipe';
    const image = resolveSuggestionImage(s, name);
    return {
      ...s,
      id: s.id || s.recipe_id || `s-${index}`,
      name,
      subtitle: s.subtitle || formatSubtitle(s),
      image,
      ingredients: s.ingredients,
      steps: s.steps || undefined,
      difficulty_level: s.difficulty_level || s.difficulty,
      cooking_time: s.cooking_time || s.time,
      why_suggested: s.why_suggested || s.reason,
      ingredientsHave: Array.isArray(s.ingredients_have) ? s.ingredients_have : [],
      ingredientsNeed: Array.isArray(s.ingredients_need) ? s.ingredients_need : [],
    };
  });
}

function parsePantryInput(text) {
  if (!text || !`${text}`.trim()) return [];
  return `${text}`
    .split(/[,;\n]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
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
  return `Hey ${displayName}! Here are recipes based on your tastes and meals your friends have been cooking lately.`;
}

export default function AISuggestionsScreen({ navigation }) {
  const { user, following } = useAuth();
  const { addToNextUp, isInNextUp } = useNextUp();
  const username = user?.username || 'current_user';
  const displayName = user?.name || username;
  const hasFollowing = following.length > 0;

  const [loading, setLoading] = useState(false);
  const [hasLogs, setHasLogs] = useState(false);
  const [hasFriends, setHasFriends] = useState(false);
  const [preferenceSuggestions, setPreferenceSuggestions] = useState([]);
  const [friendSuggestions, setFriendSuggestions] = useState([]);
  const [pantryText, setPantryText] = useState('');
  const [pantryActive, setPantryActive] = useState(null);
  const [pantryResolved, setPantryResolved] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) return undefined;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [loading, pulseAnim]);

  useFocusEffect(
    useCallback(() => {
      if (!pantryResolved) {
        return undefined;
      }

      let isMounted = true;

      const fetchSuggestions = async (pantryList = null) => {
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
          const body = { username, limit: 6 };
          if (pantryList && pantryList.length > 0) {
            body.pantry_ingredients = pantryList;
          }

          const response = await fetch(`${API_URL}/getSuggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!isMounted) {
            return;
          }

          if (!response.ok) {
            setHasLogs(logsCount > 0);
            setHasFriends(hasFollowing);
            setPreferenceSuggestions([]);
            setFriendSuggestions([]);
            return;
          }

          const data = await response.json();
          const userHasLogs = data.has_logs ?? logsCount > 0;
          const userHasFriends =
            (data.has_friends ?? (data.total_friends ?? 0) >= 1) || hasFollowing;
          setHasLogs(userHasLogs);
          setHasFriends(userHasFriends);

          const preferenceItems = userHasLogs
            ? data.preference_suggestions || []
            : [];
          const friendItems = userHasFriends
            ? data.friend_suggestions || data.suggestions || []
            : [];

          setPreferenceSuggestions(mapApiSuggestions(preferenceItems));
          setFriendSuggestions(mapApiSuggestions(friendItems));
        } catch (err) {
          console.log('Suggestions API unavailable:', err.message);
          if (isMounted) {
            setHasLogs(logsCount > 0);
            setHasFriends(hasFollowing);
            setPreferenceSuggestions([]);
            setFriendSuggestions([]);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchSuggestions(pantryActive);
      return () => {
        isMounted = false;
      };
    }, [username, hasFollowing, pantryActive, pantryResolved])
  );

  const handleSkipPantry = () => {
    setPantryText('');
    setPantryActive([]);
    setPantryResolved(true);
  };

  const handleMatchPantry = () => {
    const parsed = parsePantryInput(pantryText);
    if (parsed.length === 0) {
      Alert.alert('Add ingredients', 'Enter what you have on hand, separated by commas.');
      return;
    }
    setPantryActive(parsed);
    setPantryResolved(true);
  };

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
  const showFriendEmpty = !loading && (!hasFriends || friendSuggestions.length === 0);

  const preferenceEmptyCopy = {
    title: 'Nothing to suggest yet',
    hint: 'Log your first meal and we will start picking recipes for you.',
  };

  const friendEmptyCopy = !hasFriends
    ? {
        title: 'No friend picks yet',
        hint: 'Follow friends to see what they\'re cooking.',
      }
    : {
        title: 'No friend-inspired picks yet',
        hint: 'When friends log meals, similar recipe ideas will show up here.',
      };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, shadows.header]}
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
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerBadge}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Munchable AI</Text>
            <Text style={styles.headerSubtitle}>Curated picks, just for you</Text>
          </View>
        </View>
        <View style={styles.backButton} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !pantryResolved && styles.scrollContentPantryFocus,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!pantryResolved ? (
          <View style={styles.pantryFocusWrap}>
            <View style={[styles.pantryCard, styles.pantryCardFocus, shadows.cardSoft]}>
              <View style={styles.pantryHeader}>
                <Ionicons name="basket-outline" size={20} color={colors.primary} />
                <Text style={styles.pantryTitle}>What's in your pantry?</Text>
              </View>
              <Text style={styles.pantryHint}>
                List ingredients you have and we'll rank recipes you can make, or skip to see your usual picks.
              </Text>
              <TextInput
                style={styles.pantryInput}
                placeholder="e.g. chicken, rice, garlic, soy sauce"
                placeholderTextColor={colors.textMuted}
                value={pantryText}
                onChangeText={setPantryText}
                multiline
              />
              <View style={styles.pantryActions}>
                <TouchableOpacity
                  style={styles.pantrySkipButton}
                  onPress={handleSkipPantry}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pantrySkipText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pantryMatchButton}
                  onPress={handleMatchPantry}
                  activeOpacity={0.85}
                >
                  <Ionicons name="search" size={16} color="#fff" />
                  <Text style={styles.pantryMatchText}>Find matches</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <>
        <View style={[styles.greetingCard, shadows.cardSoft]}>
          <LinearGradient
            colors={[colors.cardWarm, colors.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.greetingGradient}
          >
            <View style={styles.greetingAccent} />
            <View style={styles.greetingContent}>
              <View style={styles.greetingIconWrap}>
                <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.greeting}>
                {loading ? 'Finding recipes tailored to your tastes...' : buildGreeting(displayName, hasLogs, hasFriends)}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <SectionHeader
          eyebrow="YOUR TASTES"
          title="Based on Your Preferences"
          icon="heart"
          accentColor={colors.primary}
          tintBg={colors.chipCoral}
        />
        {loading ? (
          <SkeletonRow pulseAnim={pulseAnim} />
        ) : showPreferenceEmpty ? (
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
            decelerationRate="fast"
          >
            {preferenceSuggestions.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                accentColor={colors.primary}
                reasonTint={colors.chipCoral}
                reasonTextColor={colors.chipCoralText}
                showPantry={pantryActive && pantryActive.length > 0}
                isInNextUp={isInNextUp(recipe.id)}
                onAddPress={() => handleAddToNextUp(recipe)}
                onPress={() => openRecipe(recipe)}
              />
            ))}
          </ScrollView>
        )}

        <SectionHeader
          eyebrow="YOUR CIRCLE"
          title="Inspired by Your Friends"
          icon="people"
          accentColor={colors.accent}
          tintBg={colors.chipTeal}
        />
        {loading ? (
          <SkeletonRow pulseAnim={pulseAnim} />
        ) : showFriendEmpty ? (
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
            decelerationRate="fast"
          >
            {friendSuggestions.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                accentColor={colors.accent}
                reasonTint={colors.chipTeal}
                reasonTextColor={colors.chipTealText}
                showPantry={pantryActive && pantryActive.length > 0}
                isInNextUp={isInNextUp(recipe.id)}
                onAddPress={() => handleAddToNextUp(recipe)}
                onPress={() => openRecipe(recipe)}
              />
            ))}
          </ScrollView>
        )}
          </>
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
    paddingHorizontal: spacing.md + 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  scrollContentPantryFocus: {
    flexGrow: 1,
  },
  pantryFocusWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.xl,
  },
  pantryCard: {
    marginHorizontal: spacing.md + 4,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
  },
  pantryCardFocus: {
    marginHorizontal: 0,
    marginTop: 0,
  },
  pantryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pantryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  pantryHint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginBottom: 10,
  },
  pantryInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    minHeight: 44,
    maxHeight: 80,
    marginBottom: 12,
  },
  pantryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  pantrySkipButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pantrySkipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pantryMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  pantryMatchText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  greetingCard: {
    marginHorizontal: spacing.md + 4,
    marginTop: spacing.lg,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  greetingGradient: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  greetingAccent: {
    width: 4,
    backgroundColor: colors.primary,
  },
  greetingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md + 2,
    gap: 12,
  },
  greetingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.chipCoral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  greeting: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionHeaderWrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md + 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  sectionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  sectionRule: {
    height: 3,
    width: 48,
    borderRadius: 2,
    opacity: 0.85,
  },
  sectionEmpty: {
    marginHorizontal: spacing.md + 4,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
    paddingHorizontal: spacing.lg,
  },
  sectionEmptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sectionEmptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  sectionEmptyHint: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  cardRow: {
    paddingHorizontal: spacing.md + 4,
    paddingBottom: 4,
  },
  recipeCard: {
    width: CARD_WIDTH,
    marginRight: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    zIndex: 2,
  },
  addButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  recipeImage: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: colors.borderLight,
  },
  recipeImageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  recipeBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reasonIcon: {
    marginTop: 1,
    marginRight: 6,
  },
  reasonText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  recipeSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  pantryBlock: {
    marginTop: 8,
    gap: 4,
  },
  pantryHave: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.chipTealText,
    fontWeight: '600',
  },
  pantryNeed: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.chipCoralText,
    fontWeight: '600',
  },
  skeletonCard: {
    borderColor: colors.borderLight,
  },
  skeletonImage: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: colors.borderLight,
  },
  skeletonLine: {
    backgroundColor: colors.borderLight,
    borderRadius: radii.sm,
    marginBottom: 8,
  },
  skeletonLineTitle: {
    height: 16,
    width: '85%',
  },
  skeletonLineShort: {
    height: 12,
    width: '55%',
  },
  skeletonLineReason: {
    height: 32,
    width: '100%',
    marginBottom: 0,
  },
});
