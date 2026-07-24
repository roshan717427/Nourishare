import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '../constants/theme';
import { toStepList } from '../utils/recipeParsing';

function getRecipeLink(recipe) {
  return recipe?.recipe_link || recipe?.recipeLink || null;
}

function getRecipeInstructions(recipe) {
  return recipe?.recipe_instructions || recipe?.recipeInstructions || null;
}

export function hasRecipeContent(recipe) {
  const link = getRecipeLink(recipe);
  const instructions = getRecipeInstructions(recipe);
  return !!(link?.trim() || instructions?.trim());
}

export default function RecipeSection({ recipe, style }) {
  const link = getRecipeLink(recipe)?.trim() || null;
  const instructions = getRecipeInstructions(recipe)?.trim() || null;

  if (!link && !instructions) return null;

  const instructionSteps = instructions ? toStepList(instructions) : [];
  const showAsSteps = instructionSteps.length > 1;

  const openLink = () => {
    if (!link) return;
    const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.block, style]}>
      <Text style={styles.label}>Recipe</Text>

      {link ? (
        <TouchableOpacity style={styles.linkRow} onPress={openLink} activeOpacity={0.7}>
          <Ionicons name="link-outline" size={18} color={colors.primary} />
          <Text style={styles.linkText} numberOfLines={2}>
            {link}
          </Text>
          <Ionicons name="open-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
      ) : null}

      {instructions ? (
        showAsSteps ? (
          <View style={styles.instructionsCard}>
            {instructionSteps.map((step, idx) => (
              <View key={`recipe-step-${idx}`} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{idx + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsText}>{instructionSteps[0] || instructions}</Text>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipTeal,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: colors.chipTealText,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: colors.cardWarm,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionsText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    maxFontSizeMultiplier: 1.5,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
});
