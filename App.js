import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import FinishProfileScreen from './screens/FinishProfileScreen';
import HomeScreen from './screens/HomeScreen';
import LogMealScreen from './screens/LogMealScreen';
import ProfileScreen from './screens/ProfileScreen';
import AISuggestionsScreen from './screens/AISuggestionsScreen';
import ExploreScreen from './screens/ExploreScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import FollowListScreen from './screens/FollowListScreen';
import MealPlanScreen from './screens/MealPlanScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import RecipeDetailScreen from './screens/RecipeDetailScreen';
import OnboardingTour, { ONBOARDING_STEPS } from './components/OnboardingTour';
import { ReportOtherReasonModalHost } from './components/SafetyMenuButton';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { NextUpProvider } from './context/NextUpContext';
import { normalizeUsername } from './utils/apiAuth';
import {
  addNotificationResponseListener,
  getLastNotificationResponse,
} from './utils/pushNotifications';

const Stack = createStackNavigator();

export const navigationRef = createNavigationContainerRef();

// Push payloads are attacker-influenced (anyone who learns a device's Expo push
// token can send one), so every field is validated before it reaches the
// navigator. Collections are restricted to the backend's known post sources and
// usernames must satisfy the same format rule used everywhere else.
const ALLOWED_POST_COLLECTIONS = ['logs', 'recipe_posts'];

function sanitizePostId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeCollection(value) {
  return ALLOWED_POST_COLLECTIONS.includes(value) ? value : 'logs';
}

// Map a push notification's data payload to an in-app destination.
function navigateFromNotificationData(data) {
  if (!data || typeof data !== 'object' || !navigationRef.isReady()) return;

  const postId = sanitizePostId(data.postId);
  const collection = sanitizeCollection(data.collection);

  switch (data.type) {
    case 'like':
    case 'comment':
    case 'reply':
    case 'commentLike':
    case 'recook':
    case 'tag':
      if (postId) {
        navigationRef.navigate('PostDetail', { postId, collection, fromFeed: true });
      }
      break;
    case 'follow_request':
      navigationRef.navigate('Notifications');
      break;
    case 'follow_accepted': {
      const fromUsername = normalizeUsername(data.fromUsername);
      if (fromUsername) {
        navigationRef.navigate('Profile', { username: fromUsername });
      }
      break;
    }
    default:
      break;
  }
}

// Routes notification taps to the relevant screen. Handles both taps while the
// app is running and a cold start launched from a notification.
function useNotificationNavigation(enabled) {
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const subscription = addNotificationResponseListener((response) => {
      navigateFromNotificationData(response?.notification?.request?.content?.data);
    });

    (async () => {
      if (handledColdStart.current) return;
      handledColdStart.current = true;
      const last = await getLastNotificationResponse();
      const data = last?.notification?.request?.content?.data;
      if (data) {
        // Give the navigator a moment to mount on cold start.
        setTimeout(() => navigateFromNotificationData(data), 600);
      }
    })();

    return () => subscription?.remove?.();
  }, [enabled]);
}

function RootNavigator() {
  const { user, initializing, profileStatus } = useAuth();

  if (initializing || (user && profileStatus === 'checking')) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f8fa' }}>
        <ActivityIndicator size="large" color="#4f7df0" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user && profileStatus === 'needs_setup' ? (
          <Stack.Screen name="FinishProfile" component={FinishProfileScreen} />
        ) : user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Explore" component={ExploreScreen} />
            <Stack.Screen name="LogMeal" component={LogMealScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="FollowList" component={FollowListScreen} />
            <Stack.Screen name="AISuggestions" component={AISuggestionsScreen} />
            <Stack.Screen name="MealPlan" component={MealPlanScreen} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
            <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppShell() {
  const { user, initializing, profileStatus } = useAuth();

  useNotificationNavigation(!!user && profileStatus === 'ready');

  return (
    <OnboardingProvider totalSteps={ONBOARDING_STEPS.length}>
      <RootNavigator />
      {!initializing && user && profileStatus === 'ready' ? <OnboardingTour /> : null}
      <ReportOtherReasonModalHost />
    </OnboardingProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NextUpProvider>
          <AppShell />
        </NextUpProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
