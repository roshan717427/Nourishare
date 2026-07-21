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
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNextUp } from '../context/NextUpContext';
import { colors, radii, spacing, shadows } from '../constants/theme';
import {
  resolveSuggestionImage,
  suggestionImageSource,
} from '../utils/suggestionImages';
import {
  loadCachedSuggestions,
  generateSuggestions,
  hideSuggestion,
} from '../utils/aiSuggestionsApi';
import { friendlyAiError } from '../utils/errorMessages';
import { extractFirstName } from '../utils/personalityCopy';
import { formatSuggestionReasonBody } from '../utils/suggestionReason';

const CARD_WIDTH = 200;
const IMAGE_HEIGHT = 150;

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

function RecipeCard({
  recipe,
  onPress,
  onAddPress,
  onHidePress,
  isInNextUp,
  accentColor,
  reasonTint,
  reasonTextColor,
  showPantry,
  searchQuery,
}) {
  const why = formatSuggestionReasonBody(recipe.why_suggested);
  const difficulty = recipe.difficulty_level
    ? recipe.difficulty_level.charAt(0).toUpperCase() + recipe.difficulty_level.slice(1)
    : null;
  

  return (
    <TouchableOpacity
      style={[styles.recipeCard, shadows.cardSoft]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.recipeImageWrap}>
        <Image
          source={suggestionImageSource(recipe.image)}
          style={styles.recipeImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={styles.recipeImageGradient}
        />
        <View style={styles.recipeImageActions}>
          <TouchableOpacity
            style={[styles.addButton, isInNextUp && styles.addButtonActive, shadows.cardSoft]}
            onPress={(e) => {
              e?.stopPropagation?.();
              onAddPress?.();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isInNextUp ? 'Already in Cook Next' : 'Add to Cook Next'}
          >
            <Ionicons
              name={isInNextUp ? 'checkmark' : 'add'}
              size={18}
              color={isInNextUp ? colors.card : accentColor}
            />
          </TouchableOpacity>
          {onHidePress ? (
            <TouchableOpacity
              style={[styles.hideButton, shadows.cardSoft]}
              onPress={(e) => {
                e?.stopPropagation?.();
                onHidePress?.();
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Hide suggestion"
            >
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
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

        {/* {recipe.subtitle ? (
          <Text style={styles.recipeSubtitle} numberOfLines={1}>
            {recipe.subtitle}
          </Text>
        ) : null} */}

{showPantry && (recipe.ingredientsHave?.length > 0 || recipe.ingredients_have?.length > 0 || recipe.ingredientsNeed?.length > 0 || recipe.ingredients_need?.length > 0) ? (() => {
          // Fallback guard to seamlessly handle both camelCase and snake_case backend keys
          const rawHave = recipe.ingredientsHave || recipe.ingredients_have || [];
          const rawNeed = recipe.ingredientsNeed || recipe.ingredients_need || [];

          // 1. Fetch and clean up the active user input search token
          // Replace 'userInputQuery' with your actual state reference variable if named differently
          const queryToken = (typeof searchQuery === 'string' ? searchQuery : '').trim().toLowerCase();

          let verifiedHave = [...rawHave];
          let verifiedNeed = [...rawNeed];

          // 2. Enforce strict matching rules if a user input query exists
          if (queryToken.length > 0) {
            // Strictly include in 'Have' ONLY if it perfectly matches the user's input item
            verifiedHave = rawHave.filter(item => item.trim().toLowerCase() === queryToken);

            // Re-route everything else that doesn't strictly match into 'Need'
            const excludedHaveItems = rawHave.filter(item => item.trim().toLowerCase() !== queryToken);
            
            // Merge excluded items (like 'chicken broth') into 'Need' without creating duplicates
            excludedHaveItems.forEach(item => {
              if (!verifiedNeed.some(needItem => needItem.trim().toLowerCase() === item.trim().toLowerCase())) {
                verifiedNeed.push(item);
              }
            });
          }

          return (
            <View style={styles.pantryBlock}>
              {verifiedHave.length > 0 ? (
                <Text style={styles.pantryHave} numberOfLines={2}>
                  You have: {verifiedHave.join(', ')}
                </Text>
              ) : null}

              {verifiedNeed.length > 0 ? (
                <Text style={styles.pantryNeed} numberOfLines={2}>
                  You need: {verifiedNeed.join(', ')}
                </Text>
              ) : null}
            </View>
          );
        })() : null}
      </View> {/* Explicitly closes <View style={styles.recipeBody}> */}
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

function formatSubtitle(suggestion) {
  const difficulty = suggestion.difficulty_level
    ? suggestion.difficulty_level.charAt(0).toUpperCase() +
      suggestion.difficulty_level.slice(1)
    : null;
  const time = suggestion.cooking_time || null;
  return [difficulty, time].filter(Boolean).join(' · ') || 'Suggested for you';
}

function mapApiSuggestions(items, section) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((s, index) => {
    const name = s.name || s.recipe_name || 'Recipe';
    const resolvedSection = s.section || section;
    
    // FIX: Match this variable name exactly on the rows below
    const image = resolveSuggestionImage(s, resolvedSection);
    
    return {
      ...s,
      id: s.id || s.recipe_id || `s-${index}`,
      section: resolvedSection,
      name,
      subtitle: s.subtitle || formatSubtitle(s),
      
      // FIX: Changed 'resolvedImage' to 'image' to fix the runtime crash
      image: image || s.image,
      photoUrl: image || s.photoUrl,
      
      ingredients: s.ingredients,
      description: s.description,
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

function buildGreeting(firstName) {
  return `Hey ${firstName}! Tap the button to receive recipes based on your preferences, what friends cooked, and optionally ingredients you currently have. Continue logging meals so I can learn your tastes, and keep expanding your network to find inspiration!`;
}

export default function AISuggestionsScreen({ navigation }) {
  const { user } = useAuth();
  const { addToNextUp, isInNextUp } = useNextUp();

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preferenceSuggestions, setPreferenceSuggestions] = useState([]);
  const [friendSuggestions, setFriendSuggestions] = useState([]);
  const [pantrySuggestions, setPantrySuggestions] = useState([]);
  const [resolvedName, setResolvedName] = useState(username || 'Cook');
  const [generationsRemaining, setGenerationsRemaining] = useState(3);
  const [dailyLimit, setDailyLimit] = useState(3);
  const [statusMessage, setStatusMessage] = useState('');
  const [pantryText, setPantryText] = useState('');
  const [pantrySkipped, setPantrySkipped] = useState(false);
  const [hasStartedGeneration, setHasStartedGeneration] = useState(false);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Watches the central authentication session context and overrides the initial
  // static 'Cook' placeholder with your actual name parameters as soon as they load!
  useEffect(() => {
    if (user?.name && typeof user.name === 'string') {
      const parts = user.name.trim().split(/\s+/);
      if (parts && parts[0]) {
        setResolvedName(parts[0]);
      }
    } else if (user?.username) {
      setResolvedName(user.username);
    }
  }, [user]);
  
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const pantryStripRef = useRef(null);

  const username = user?.username || 'current_user';
  const firstName = user?.name && typeof user.name === 'string' 
  ? user.name.trim().split(/\s+/)[0] 
  : (user?.username || 'Cook');

  const applySuggestionsData = useCallback((data) => {
    // 🔘 DEFENSIVE TYPE CHECK: Ignore malformed server returns safely
    if (!data || typeof data !== 'object') {
      console.log('>>> Intercepted null or malformed data payload object inside applySuggestionsData <<<');
      return;
    }

    // Safely pull array references with fallbacks to avoid map Api exceptions
    const rawPref = data.preference_suggestions || data.preferenceSuggestions || [];
    const rawFriend = data.friend_suggestions || data.friendSuggestions || [];
    const rawPantry = data.pantry_suggestions || data.pantrySuggestions || [];

    const preferenceItems = mapApiSuggestions(Array.isArray(rawPref) ? rawPref : [], 'preference');
    const friendItems = mapApiSuggestions(Array.isArray(rawFriend) ? rawFriend : [], 'friend');
    const pantryItems = mapApiSuggestions(Array.isArray(rawPantry) ? rawPantry : [], 'pantry');
    
    setPreferenceSuggestions(preferenceItems);
    setFriendSuggestions(friendItems);
    setPantrySuggestions(pantryItems);

    // =========================================================================
    // 🛠️ ENFORCE DATA EXTRACTION INSIDE THE LOOP:
    // =========================================================================
    // Hydrates your user greeting from the live Firestore collection values seamlessly
    if (data.firstName) {
      setResolvedName(data.firstName);
    } else if (data.name) {
      const extracted = String(data.name).trim().split(/\s+/);
      if (extracted && extracted[0]) setResolvedName(extracted[0]);
    }
    // =========================================================================

    if (typeof data.generations_remaining === 'number') {
      setGenerationsRemaining(data.generations_remaining);
    }
    if (typeof data.daily_limit === 'number') {
      setDailyLimit(data.daily_limit);
    }

    const hasVisible = preferenceItems.length > 0 || friendItems.length > 0 || pantryItems.length > 0;
    const hasCachedTotal = (data.total_cached || 0) > 0;
    
    if (hasVisible || hasCachedTotal) {
      setHasStartedGeneration(true);
    }
  }, []);

  const loadCached = useCallback(async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const data = await loadCachedSuggestions(username);
      applySuggestionsData(data);
    } catch (err) {
      // Never surface a "not found" style message before the user has generated;
      // an empty cache is a normal first-run state, not an error to show.
      console.log('Could not load cached suggestions:', err.message);
    } finally {
      setHasLoadedCache(true);
      setLoading(false);
    }
  }, [username, applySuggestionsData]);

  const handleGenerate = async () => {
    if (generating) return;
    if (generationsRemaining <= 0) {
      const message = friendlyAiError({ code: 'daily_limit_exceeded' });
      setStatusMessage(message);
      Alert.alert('Daily limit reached', message);
      return;
    }

    // Single generate button for the whole page: if the user typed pantry
    // ingredients (and hasn't skipped), send them so the server returns a pantry
    // section with 2 recipes per section; otherwise 3 recipes per section.
    const pantryForRequest = pantrySkipped ? [] : parsePantryInput(pantryText);

    setHasStartedGeneration(true);
    setGenerating(true);
    setStatusMessage('');
    try {
      const data = await generateSuggestions(username, pantryForRequest);
      applySuggestionsData(data);
      if (data.generated_count > 0) {
        setStatusMessage(`Added ${data.generated_count} new recipe ideas!`);
      }
    } catch (err) {
      console.log('Generate suggestions failed:', err.message);
      const message = friendlyAiError(err);
      setStatusMessage(message);
      Alert.alert(err.status === 429 ? 'Limit reached' : 'Could not generate suggestions', message);
    } finally {
      setGenerating(false);
    }
  };

  const handleHideRecipe = (recipe, section) => {
    Alert.alert(
      'Hide this suggestion?',
      `"${recipe.name}" will be hidden from your list. You may see it again in a future generation.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            try {
              await hideSuggestion(username, recipe.id);
              if (section === 'preference') {
                setPreferenceSuggestions((prev) => prev.filter((r) => r.id !== recipe.id));
              } else if (section === 'friend') {
                setFriendSuggestions((prev) => prev.filter((r) => r.id !== recipe.id));
              } else {
                setPantrySuggestions((prev) => prev.filter((r) => r.id !== recipe.id));
              }
            } catch (err) {
              Alert.alert('Could not hide', friendlyAiError(err));
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!user || !user.username) return;
    if (!loading && !generating) return undefined;

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
  }, [loading, generating, pulseAnim]);

  // Locate the focus hook inside your primary AI Suggestions Screen File
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const refreshSuggestionsData = async () => {
        try {
          // FIX: Activated your real loading state hook
          setLoading(true);
          
          // FIX: Removed 'db' parameter since loadCachedSuggestions handles it natively via username
          const freshPayload = await loadCachedSuggestions(username);
          if (isMounted && freshPayload) {
            applySuggestionsData(freshPayload);
          }
        } catch (err) { 
          console.error("Failed to re-sync suggestions state:", err); 
        } finally { 
          // FIX: Toggled loading back to false cleanly
          setLoading(false); 
        }
      };
      refreshSuggestionsData();
      return () => { isMounted = false; };
    }, [username, applySuggestionsData])
  );



  const handleSkipPantry = () => {
    setPantryText('');
    setPantrySkipped(true);
    setStatusMessage('');
  };

  const openRecipe = (recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  const handleAddToNextUp = (recipe) => {
    if (isInNextUp(recipe.id)) {
      Alert.alert('Already in Cook Next', `"${recipe.name}" is already on your list.`);
      return;
    }

    const recipeWithImages = {
      ...recipe,
      image: recipe.image,       // Resolves your local asset properties
      photoUrl: recipe.photoUrl, // Resolves backup web path identifiers
    };

    const added = addToNextUp(recipe);
    if (added) {
      Alert.alert('Saved to Cook Next', `"${recipe.name}" is on your private cooking queue.`);
    }
  };

  const hasAnyRecipes =
    preferenceSuggestions.length > 0 ||
    friendSuggestions.length > 0 ||
    pantrySuggestions.length > 0;
  const isBusy = loading || generating;
  const showPantrySection = pantrySuggestions.length > 0;
  // After a generation completes with nothing to show, surface the not-found line
  // directly under the generate button (never on first load). Suppressed when a
  // statusMessage is already showing (e.g. an error) to avoid a duplicate message.
  const showNotFound = hasStartedGeneration && !isBusy && !hasAnyRecipes && !statusMessage;
  // Recipe sections only appear once we're generating or have results.
  const showSections = isBusy || hasAnyRecipes;

  const greetingText = isBusy
    ? generating
      ? 'Cooking up fresh AI recipe ideas...'
      : 'Loading your saved suggestions...'
    : buildGreeting(resolvedName);

  const generateDisabled = generating || generationsRemaining <= 0;

  const renderGenerateButton = () => (
    <View style={styles.generateWrap}>
      <TouchableOpacity
        style={[styles.bigGenerateButton, shadows.cardSoft, generateDisabled && styles.generateButtonDisabled]}
        onPress={handleGenerate}
        disabled={generateDisabled}
        activeOpacity={0.85}
      >
        <View style={styles.bigGenerateTitleRow}>
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.bigGenerateButtonText}>
            {generating ? 'Generating...' : 'Generate recipes'}
          </Text>
        </View>
        <Text style={styles.bigGenerateCount}>
          {generationsRemaining} of {dailyLimit} generations left today
        </Text>
      </TouchableOpacity>
      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
    </View>
  );

  const renderPantryStrip = () => (
    <View ref={pantryStripRef} collapsable={false}>
      <View style={[styles.pantryStrip, shadows.cardSoft]}>
        <View style={styles.pantryHeader}>
          <Ionicons name="basket-outline" size={20} color={colors.primary} />
          <Text style={styles.pantryTitle}>What's in your pantry?</Text>
        </View>
        <TextInput
          style={styles.pantryInput}
          placeholder="e.g. chicken, rice, garlic, soy sauce"
          placeholderTextColor={colors.textMuted}
          value={pantryText}
          onChangeText={setPantryText}
          multiline
          onFocus={() => {
            setTimeout(() => {
              pantryStripRef.current?.measureLayout(
                scrollRef.current?.getInnerViewNode?.() ?? scrollRef.current,
                (_x, y) => {
                  scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
                },
                () => {}
              );
            }, 300);
          }}
        />
        <View style={styles.pantryActions}>
          <TouchableOpacity
            style={styles.pantrySkipButton}
            onPress={handleSkipPantry}
            activeOpacity={0.7}
          >
            <Text style={styles.pantrySkipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderPantrySection = () => (
    <>
      <SectionHeader
        eyebrow="YOUR KITCHEN"
        title="Based on Your Pantry"
        icon="basket"
        accentColor={colors.chipAmberText}
        tintBg={colors.chipAmber}
      />
      {isBusy ? (
        <SkeletonRow pulseAnim={pulseAnim} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRow}
          decelerationRate="fast"
        >
        {Array.isArray(pantrySuggestions) && pantrySuggestions.length > 0 ? (
          pantrySuggestions.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              accentColor={colors.chipAmberText}
              reasonTint={colors.chipAmber}
              reasonTextColor={colors.chipAmberText}
              showPantry
              isInNextUp={isInNextUp(recipe.id)}
              onAddPress={() => handleAddToNextUp(recipe)}
              onHidePress={() => handleHideRecipe(recipe, 'pantry')}
              onPress={() => openRecipe(recipe)}
            />
          ))
        ) : (
          <Text style={styles.emptySectionText}>No pantry-based suggestions yet.</Text>
        )}
        </ScrollView>
      )}
    </>
  );

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
            <Text style={styles.headerTitle}>Nourishare AI</Text>
            <Text style={styles.headerSubtitle}>Curated picks, just for you</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </LinearGradient>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >

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
              <Text style={styles.greeting}>{greetingText}</Text>
            </View>
          </LinearGradient>
        </View>

        {renderGenerateButton()}

        {showNotFound ? (
          <Text style={styles.notFoundText}>We couldn't find what you were looking for.</Text>
        ) : null}

        {!pantrySkipped ? renderPantryStrip() : null}

        {showPantrySection ? renderPantrySection() : null}

        {showSections ? (
          <>
            {isBusy || preferenceSuggestions.length > 0 ? (
              <>
                <SectionHeader
                  eyebrow="YOUR TASTES"
                  title="Preference-Inspired"
                  icon="heart"
                  accentColor={colors.primary}
                  tintBg={colors.chipCoral}
                />
                {isBusy ? (
                  <SkeletonRow pulseAnim={pulseAnim} />
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cardRow}
                    decelerationRate="fast"
                  >
                  {Array.isArray(preferenceSuggestions) && preferenceSuggestions.length > 0 ? (
                    preferenceSuggestions.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        accentColor={colors.primary}
                        reasonTint={colors.chipCoral}
                        reasonTextColor={colors.chipCoralText}
                        showPantry={showPantrySection}
                        isInNextUp={isInNextUp(recipe.id)}
                        onAddPress={() => handleAddToNextUp(recipe)}
                        onHidePress={() => handleHideRecipe(recipe, 'preference')}
                        onPress={() => openRecipe(recipe)}
                      />
                    ))
                  ) : (
                    <Text style={styles.emptySectionText}>No preference-based suggestions yet.</Text>
                  )}
                  </ScrollView>
                )}
              </>
            ) : null}

            {isBusy || friendSuggestions.length > 0 ? (
              <>
                <SectionHeader
                  eyebrow="YOUR CIRCLE"
                  title="Friend-Inspired"
                  icon="people"
                  accentColor={colors.accent}
                  tintBg={colors.chipTeal}
                />
                {isBusy ? (
                  <SkeletonRow pulseAnim={pulseAnim} />
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cardRow}
                    decelerationRate="fast"
                  >
                  {Array.isArray(friendSuggestions) && friendSuggestions.length > 0 ? (
                    friendSuggestions.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        accentColor={colors.accent}
                        reasonTint={colors.chipTeal}
                        reasonTextColor={colors.chipTealText}
                        showPantry={showPantrySection}
                        isInNextUp={isInNextUp(recipe.id)}
                        onAddPress={() => handleAddToNextUp(recipe)}
                        onHidePress={() => handleHideRecipe(recipe, 'friend')}
                        onPress={() => openRecipe(recipe)}
                      />
                    ))
                  ) : (
                    <Text style={styles.emptySectionText}>No recipe ideas from your friends yet.</Text>
                  )}
                  </ScrollView>
                )}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
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
  headerSpacer: {
    width: 40,
    height: 40,
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
  generateWrap: {
    marginHorizontal: spacing.md + 4,
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  bigGenerateButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    paddingVertical: 20,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bigGenerateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bigGenerateButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  bigGenerateCount: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  notFoundText: {
    marginHorizontal: spacing.md + 4,
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  pantryStrip: {
    marginHorizontal: spacing.md + 4,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.md + 2,
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
  generateCard: {
    marginHorizontal: spacing.md + 4,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
  },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  generateTextWrap: {
    flex: 1,
  },
  generateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  generateHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  generateButtonDisabled: {
    opacity: 0.55,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  statusMessage: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
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
    backgroundColor: colors.card || '#ffffff',
    borderRadius: radii.xl || 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    height: 'auto',
  },
  recipeImageWrap: {
    position: 'relative',
  },
  recipeImageActions: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  hideButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
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
    justifyContent: 'flex-start',
    flexGrow: 0,
    padding: 12,
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
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
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
  reasonContent: {
    flex: 1,
  },
  reasonHeader: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  reasonText: {
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




