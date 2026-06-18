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
  const [currentStep, setCurrentStep] = useState(0);
  const [tourActive, setTourActive] = useState(false);
  const checkedUsernameRef = useRef(null);
  const sessionDismissedRef = useRef(false);
  const checkGenerationRef = useRef(0);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user?.username) {
      checkedUsernameRef.current = null;
      sessionDismissedRef.current = false;
      setTourActive(false);
      setCurrentStep(0);
      return;
    }

    if (sessionDismissedRef.current) {
      setTourActive(false);
      return;
    }

    const username = user.username;

    // Already resolved for this user in this session — avoid ready/visible flicker
    // when auth re-renders with the same username.
    if (checkedUsernameRef.current === username) {
      return;
    }

    const generation = ++checkGenerationRef.current;
    let cancelled = false;

    (async () => {
      try {
        const completed = await AsyncStorage.getItem(getOnboardingStorageKey(username));
        if (cancelled || generation !== checkGenerationRef.current) return;
        if (sessionDismissedRef.current) return;

        checkedUsernameRef.current = username;
        const shouldShow = completed !== 'true';
        setTourActive(shouldShow);
        if (shouldShow) {
          setCurrentStep(0);
        }
      } catch {
        // Fail open — don't block the app if storage is unavailable.
        if (!cancelled && generation === checkGenerationRef.current && !sessionDismissedRef.current) {
          checkedUsernameRef.current = username;
          setTourActive(false);
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

  const dismissTour = useCallback(async () => {
    sessionDismissedRef.current = true;
    setTourActive(false);
    setCurrentStep(0);
    await persistCompletion();
  }, [persistCompletion]);

  const completeTour = useCallback(() => {
    dismissTour();
  }, [dismissTour]);

  const skipTour = useCallback(() => {
    dismissTour();
  }, [dismissTour]);

  const nextStep = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      dismissTour();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  }, [currentStep, totalSteps, dismissTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const visible = tourActive && !!user?.username && !sessionDismissedRef.current;

  return (
    <OnboardingContext.Provider
      value={{
        visible,
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
