import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '../constants/theme';
import { toIngredientList, getRecipeSteps } from '../utils/recipeParsing';
import RecipeSection, { hasRecipeContent } from '../components/RecipeSection';
import { sectionSuggestionImage, suggestionImageSource } from '../utils/suggestionImages';
import { formatSuggestionReasonBody } from '../utils/suggestionReason';


/** Normalize API reason text for "Suggested because {reason}." */

export default function RecipeDetailScreen({ navigation, route }) {
  const recipe = route?.params?.recipe || {};

  const renderRecipeIngredients = () => {
    const list = Array.isArray(recipe?.ingredients)
      ? recipe.ingredients
      : typeof recipe?.ingredients === 'string'
        ? recipe.ingredients.split(/[,;\n]+/)
        : [];

    if (list.length === 0) return null;

    return (
      <View style={[styles.detailIngredientsCard, shadows.cardSoft]}>
        <View style={styles.detailHeaderRow}>
          <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
          <Text style={styles.detailIngredientsTitle}>Ingredients Needed</Text>
        </View>
        <View style={styles.detailIngredientsGrid}>
          {list.map((ingredient, index) => (
            <View key={index} style={styles.detailBulletRow}>
              <Text style={styles.detailBulletDot}>🔸</Text>
              <Text style={styles.detailIngredientText}>{String(ingredient).trim()}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const name = recipe.name || recipe.recipe_name || 'Recipe';
  const image = recipe.section
    ? sectionSuggestionImage(recipe.section)
    : suggestionImageSource(recipe.image || recipe.photoUrl) || null;
  const difficulty = recipe.difficulty_level || recipe.difficulty || null;
  const time = recipe.cooking_time || recipe.time || null;
  const rating = recipe.rating != null && recipe.rating !== '' ? recipe.rating : null;
  const author = recipe.username || null;
  const inspiredBy = recipe.inspired_by || null;
  const inspiredByUsername = recipe.inspired_by_username || null;
  const why = formatSuggestionReasonBody(recipe.why_suggested);

  const ingredients = toIngredientList(recipe.ingredients);
  const ingredientsHave = Array.isArray(recipe.ingredientsHave) ? recipe.ingredientsHave : [];
  const ingredientsNeed = Array.isArray(recipe.ingredientsNeed) ? recipe.ingredientsNeed : [];
  const showPantrySplit = ingredientsHave.length > 0 || ingredientsNeed.length > 0;
  const steps = getRecipeSteps(recipe);
  const notes = recipe.cooking_notes || recipe.notes || null;
  const showNotesSeparately = steps.length > 0 && notes && !steps.includes(notes);

  const difficultyLabel = difficulty
    ? `${difficulty}`.charAt(0).toUpperCase() + `${difficulty}`.slice(1)
    : null;

  const metaChips = [
    difficultyLabel ? { icon: 'speedometer-outline', text: difficultyLabel, tint: colors.chipTeal, textColor: colors.chipTealText } : null,
    time ? { icon: 'time-outline', text: `${time}`, tint: colors.chipAmber, textColor: colors.chipAmberText } : null,
    rating ? { icon: 'star', text: `${rating}/5`, tint: colors.chipCoral, textColor: colors.chipCoralText } : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Recipe
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {image ? (
          <Image source={suggestionImageSource(image)} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{name}</Text>
          {inspiredBy ? (
            <Text style={styles.byline}>
              Inspired by{' '}
              {inspiredByUsername ? (
                <Text
                  style={styles.bylineLink}
                  onPress={() => navigation.navigate('Profile', { username: inspiredByUsername })}
                >
                  {inspiredBy}
                </Text>
              ) : (
                inspiredBy
              )}
            </Text>
          ) : author ? (
            <Text style={styles.byline}>
              Cooked by{' '}
              <Text
                style={styles.bylineLink}
                onPress={() => navigation.navigate('Profile', { username: author })}
              >
                {author}
              </Text>
            </Text>
          ) : null}

          {metaChips.length > 0 ? (
            <View style={styles.metaRow}>
              {metaChips.map((chip) => (
                <View key={chip.text} style={[styles.metaChip, { backgroundColor: chip.tint }]}>
                  <Ionicons name={chip.icon} size={16} color={chip.textColor} />
                  <Text style={[styles.metaChipText, { color: chip.textColor }]}>{chip.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {why ? (
            <View style={styles.whyBox}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <View style={styles.whyContent}>
                <Text style={styles.whyHeader}>Why was this suggested?</Text>
                <Text style={styles.whyText}>{why}</Text>
              </View>
            </View>
          ) : null}

          {recipe.description ? (
            <>
              <Text style={styles.sectionTitle}>The recipe:</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{recipe.description}</Text>
              </View>
            </>
          ) : null}

          {author && hasRecipeContent(recipe) ? (
            <RecipeSection recipe={recipe} style={styles.recipeSection} />
          ) : null}

          {showPantrySplit ? (
            <>
              {ingredientsHave.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>You have</Text>
                  <View style={[styles.ingredientsCard, styles.ingredientsHaveCard]}>
                    {ingredientsHave.map((item, idx) => (
                      <View key={`have-${idx}`} style={styles.bulletRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.chipTealText} />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
              {ingredientsNeed.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>You need</Text>
                  <View style={[styles.ingredientsCard, styles.ingredientsNeedCard]}>
                    {ingredientsNeed.map((item, idx) => (
                      <View key={`need-${idx}`} style={styles.bulletRow}>
                        <Ionicons name="cart-outline" size={16} color={colors.chipCoralText} />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          {/*
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {ingredients.length > 0 ? (
            <View style={styles.ingredientsCard}>
              {ingredients.map((item, idx) => (
                <View key={`ing-${idx}`} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Ingredient list isn't available for this recipe yet.
            </Text>
          )}
          */}

          <Text style={styles.sectionTitle}>How to cook</Text>
          {steps.length > 0 ? (
            <View style={styles.stepsCard}>
              {steps.map((step, idx) => (
                <View key={`step-${idx}`} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Step-by-step instructions aren't available yet. Try searching for
              "{name}" online for a full recipe.
            </Text>
          )}

          {showNotesSeparately ? (
            <>
              <Text style={styles.sectionTitle}>Chef's notes</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{notes}</Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailIngredientsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailIngredientsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  detailIngredientsGrid: {
    marginTop: 4,
    gap: 8,
  },
  detailBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  detailBulletDot: {
    fontSize: 12,
    top: 2,
  },
  detailIngredientText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: colors.borderLight,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  byline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  bylineLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  metaChipText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  whyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.chipCoral,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  whyContent: {
    flex: 1,
    marginLeft: 8,
  },
  whyHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.chipCoralText,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 14,
    color: colors.chipCoralText,
    lineHeight: 20,
  },
  recipeSection: {
    marginTop: 16,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  ingredientsCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientsHaveCard: {
    backgroundColor: colors.chipTeal,
    borderColor: colors.chipTeal,
  },
  ingredientsNeedCard: {
    backgroundColor: colors.chipCoral,
    borderColor: colors.chipCoral,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    lineHeight: 23,
  },
  stepsCard: {
    backgroundColor: colors.cardWarm,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  notesCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
