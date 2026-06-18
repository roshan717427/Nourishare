import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const STORAGE_PREFIX = '@munchable/onboarding_complete_';
const UID_STORAGE_PREFIX = '@munchable/onboarding_complete_uid_';

export function getOnboardingStorageKey(username) {
  return `${STORAGE_PREFIX}${username}`;
}

export function getOnboardingUidStorageKey(uid) {
  return `${UID_STORAGE_PREFIX}${uid}`;
}

export async function clearOnboardingStorage(username, uid) {
  const keys = [];
  if (username) keys.push(getOnboardingStorageKey(username));
  if (uid) keys.push(getOnboardingUidStorageKey(uid));
  if (keys.length === 0) return;
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {
    // Ignore — best-effort cleanup on account delete.
  }
}

const OnboardingContext = createContext({
  visible: false,
  currentStep: 0,
  totalSteps: 0,
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  dontShowAgain: () => {},
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
        const [completedByUsername, completedByUid] = await Promise.all([
          AsyncStorage.getItem(getOnboardingStorageKey(username)),
          user.uid ? AsyncStorage.getItem(getOnboardingUidStorageKey(user.uid)) : null,
        ]);
        if (cancelled || generation !== checkGenerationRef.current) return;
        if (sessionDismissedRef.current) return;

        checkedUsernameRef.current = username;
        const shouldShow = completedByUsername !== 'true' && completedByUid !== 'true';
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
  }, [user?.username, user?.uid, initializing]);

  const persistCompletion = useCallback(async () => {
    if (!user?.username) return;
    try {
      const entries = [[getOnboardingStorageKey(user.username), 'true']];
      if (user.uid) {
        entries.push([getOnboardingUidStorageKey(user.uid), 'true']);
      }
      await AsyncStorage.multiSet(entries);
    } catch {
      // Ignore — tour is already dismissed in UI.
    }
  }, [user?.username, user?.uid]);

  const dismissForSession = useCallback(() => {
    sessionDismissedRef.current = true;
    setTourActive(false);
    setCurrentStep(0);
  }, []);

  const dismissPermanently = useCallback(async () => {
    sessionDismissedRef.current = true;
    setTourActive(false);
    setCurrentStep(0);
    await persistCompletion();
  }, [persistCompletion]);

  const completeTour = useCallback(() => {
    dismissPermanently();
  }, [dismissPermanently]);

  const skipTour = useCallback(() => {
    dismissForSession();
  }, [dismissForSession]);

  const dontShowAgain = useCallback(() => {
    dismissPermanently();
  }, [dismissPermanently]);

  const nextStep = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      dismissPermanently();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  }, [currentStep, totalSteps, dismissPermanently]);

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
        dontShowAgain,
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
