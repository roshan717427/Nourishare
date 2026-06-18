import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const STORAGE_PREFIX = '@munchable/onboarding_complete_';

export function getOnboardingStorageKey(username) {
  return `${STORAGE_PREFIX}${username}`;
}

const OnboardingContext = createContext({
  visible: false,
  currentStep: 0,
  totalSteps: 0,
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  completeTour: () => {},
});

export function OnboardingProvider({ children, totalSteps }) {
  const { user, initializing } = useAuth();
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [ready, setReady] = useState(false);
  const checkedUserRef = useRef(null);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user?.username) {
      setVisible(false);
      setCurrentStep(0);
      setReady(false);
      checkedUserRef.current = null;
      return;
    }

    let cancelled = false;
    const isNewUser = checkedUserRef.current !== user.username;
    if (isNewUser) {
      setReady(false);
    }

    (async () => {
      try {
        const key = getOnboardingStorageKey(user.username);
        const completed = await AsyncStorage.getItem(key);
        if (cancelled) return;
        checkedUserRef.current = user.username;
        setVisible(completed !== 'true');
        setCurrentStep(0);
        setReady(true);
      } catch {
        // Fail open — don't block the app if storage is unavailable.
        if (!cancelled) {
          checkedUserRef.current = user.username;
          setVisible(false);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.username, initializing]);

  const persistCompletion = useCallback(async () => {
    if (!user?.username) return;
    try {
      await AsyncStorage.setItem(getOnboardingStorageKey(user.username), 'true');
    } catch {
      // Ignore — tour is already dismissed in UI.
    }
  }, [user?.username]);

  const completeTour = useCallback(async () => {
    setVisible(false);
    setCurrentStep(0);
    await persistCompletion();
  }, [persistCompletion]);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const nextStep = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      completeTour();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  }, [currentStep, totalSteps, completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const showTour = visible && ready && !!user;

  return (
    <OnboardingContext.Provider
      value={{
        visible: showTour,
        currentStep,
        totalSteps,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export default OnboardingContext;
