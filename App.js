import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import LogMealScreen from './screens/LogMealScreen';
import ProfileScreen from './screens/ProfileScreen';
import AISuggestionsScreen from './screens/AISuggestionsScreen';
import ExploreScreen from './screens/ExploreScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import RecipeDetailScreen from './screens/RecipeDetailScreen';
import OnboardingTour, { ONBOARDING_STEPS } from './components/OnboardingTour';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { NextUpProvider } from './context/NextUpContext';

const Stack = createStackNavigator();

function RootNavigator() {
  const { user, initializing } = useAuth();

  // While Firebase restores the persisted session, show a brief loading state
  // so we don't flash the Login screen for already-signed-in users.
  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f8fa' }}>
        <ActivityIndicator size="large" color="#4f7df0" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Explore" component={ExploreScreen} />
            <Stack.Screen name="LogMeal" component={LogMealScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="AISuggestions" component={AISuggestionsScreen} />
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
  return (
    <OnboardingProvider totalSteps={ONBOARDING_STEPS.length}>
      <RootNavigator />
      <OnboardingTour />
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
