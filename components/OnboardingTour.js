import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from '../context/OnboardingContext';
import { colors, spacing, radii } from '../constants/theme';

export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    icon: 'home',
    title: 'Welcome to Munchable!',
    description:
      'Your home feed shows what friends are cooking. Drop likes, leave comments, and get inspired!',
    tabLabel: 'Home',
  },
  {
    id: 'stories',
    icon: 'albums-outline',
    title: 'Sticky friend stories',
    description:
      'Tap a story circle to jump to that friend\'s posts. Circles stay pinned at the top while you scroll, so switching friends is always one tap away!',
    tabLabel: 'Home',
  },
  {
    id: 'explore',
    icon: 'search',
    title: 'Discover cooks',
    description:
      'Search for people and follow friends to fill your feed with meals you care about!',
    tabLabel: 'Explore',
  },
  {
    id: 'ai',
    icon: 'sparkles',
    title: 'AI recipe ideas',
    description:
      'Get personalized suggestions from your tastes, friends, and pantry. Tap + on any recipe to save it to your Cook Next portfolio!',
    tabLabel: 'AI',
  },
  {
    id: 'post',
    icon: 'add-circle',
    title: 'Log what you cook',
    description:
      'Snap a photo, describe & rate your dish, tag other users, and share the recipe with your network!',
    tabLabel: 'Post',
  },
  {
    id: 'profile',
    icon: 'person',
    title: 'Your kitchen profile',
    description:
      'See your cooking stats, kitchen personality, and every dish you\'ve logged!',
    tabLabel: 'Profile',
  },
  {
    id: 'portfolio',
    icon: 'heart',
    title: 'Culinary Portfolio',
    description:
      'Heart up to 2 dishes to showcase on your profile. Friends see your picks and can open your full gallery!',
    tabLabel: 'Profile',
  },
  {
    id: 'next-up',
    icon: 'list',
    title: 'Cook Next Portfolio',
    description:
      'Your private Cook Next portfolio saves recipes you want to try. Only you can see it!',
    tabLabel: 'Profile',
  },
  {
    id: 'meal-planning',
    icon: 'calendar',
    title: 'Meal planning',
    description:
      'Use the built-in calendar to plan meals; view a generated, up-to-date shopping list to buy the missing ingredients for them!',
    tabLabel: 'Profile',
  },
];

const TAB_ICONS = {
  Home: { icon: 'home-outline', activeIcon: 'home' },
  Explore: { icon: 'search-outline', activeIcon: 'search' },
  AI: { icon: 'sparkles-outline', activeIcon: 'sparkles' },
  Post: { icon: 'add-circle-outline', activeIcon: 'add-circle' },
  Profile: { icon: 'person-outline', activeIcon: 'person' },
};

function TabHint({ activeLabel }) {
  const tabs = ['Home', 'Explore', 'AI', 'Post', 'Profile'];

  return (
    <View style={styles.tabHintRow}>
      {tabs.map((label) => {
        const isActive = label === activeLabel;
        const icons = TAB_ICONS[label];
        return (
          <View key={label} style={styles.tabHintItem}>
            <Ionicons
              name={isActive ? icons.activeIcon : icons.icon}
              size={20}
              color={isActive ? colors.navActive : colors.navInactive}
            />
            <Text style={[styles.tabHintLabel, isActive && styles.tabHintLabelActive]}>
              {label}
            </Text>
            {isActive ? <View style={styles.tabHintDot} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export default function OnboardingTour() {
  const insets = useSafeAreaInsets();
  const { visible, currentStep, totalSteps, nextStep, prevStep, skipTour, dontShowAgain } =
    useOnboarding();

  const step = ONBOARDING_STEPS[currentStep];
  if (!step) {
    return null;
  }

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep >= totalSteps - 1;
  const modalVisible = visible && !!step;

  return (
    <Modal visible={modalVisible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable style={styles.backdrop} onPress={skipTour} accessibilityLabel="Skip tour" />

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.dontShowAgainButton}
            onPress={dontShowAgain}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Don't show this again"
          >
            <Text style={styles.dontShowAgainText}>Don't show this again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={skipTour}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip tour"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons name={step.icon} size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <TabHint activeLabel={step.tabLabel} />

          <View style={styles.dotsRow}>
            {ONBOARDING_STEPS.map((s, index) => (
              <View
                key={s.id}
                style={[styles.dot, index === currentStep && styles.dotActive]}
              />
            ))}
          </View>

          <View style={[styles.buttonRow, isFirstStep && styles.buttonRowFirst]}>
            {!isFirstStep ? (
              <TouchableOpacity
                style={[styles.secondaryButton, styles.navButton]}
                onPress={prevStep}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Previous step"
              >
                <Ionicons name="arrow-back" size={18} color={colors.primary} style={styles.backButtonIcon} />
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isFirstStep ? styles.primaryButtonFirst : styles.navButton,
              ]}
              onPress={nextStep}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isLastStep ? 'Finish tour' : 'Next step'}
            >
              <Text style={styles.primaryButtonText}>{isLastStep ? 'Got it' : 'Next'}</Text>
              {!isLastStep ? (
                <Ionicons name="arrow-forward" size={18} color={colors.card} style={styles.buttonIcon} />
              ) : null}
            </TouchableOpacity>
          </View>

          <Text style={styles.stepCounter}>
            {currentStep + 1} of {totalSteps}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  skipButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: spacing.xs,
    zIndex: 1,
  },
  dontShowAgainButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    padding: spacing.xs,
    zIndex: 1,
    maxWidth: '55%',
  },
  dontShowAgainText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  skipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.chipCoral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tabHintRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabHintItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  tabHintLabel: {
    fontSize: 9,
    color: colors.navInactive,
    marginTop: 2,
  },
  tabHintLabelActive: {
    color: colors.navActive,
    fontWeight: '700',
  },
  tabHintDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navActive,
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  buttonRowFirst: {
    justifyContent: 'center',
  },
  navButton: {
    flex: 1,
    flexBasis: 0,
    minHeight: 48,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  backButtonIcon: {
    marginRight: spacing.xs,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  primaryButtonFirst: {
    flex: 0,
    minWidth: 140,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginLeft: spacing.sm,
  },
  stepCounter: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
  },
});
