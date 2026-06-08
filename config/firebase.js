// Firebase client (web JS SDK) configuration.
//
// This uses the Firebase JS SDK, which works in Expo Go (no native rebuild
// required). See FIREBASE_SETUP.md for step-by-step setup instructions.
//
// ── WHERE TO PASTE YOUR CONFIG ────────────────────────────────────────────
// Replace the PLACEHOLDER strings below with the values from your Firebase
// web app config (Firebase console → Project settings → "Your apps" → Web app
// → SDK setup and configuration → Config). You can also override any value
// via app.json `expo.extra.firebase` (read through expo-constants) so you can
// keep secrets out of source control if you prefer.
//
// NOTE: These are NOT secrets that need to be hidden — the Firebase web API
// key is a public client identifier. Access is controlled by Firestore rules
// and the enabled auth providers, not by hiding this key.
import Constants from 'expo-constants';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
// NOTE: `getReactNativePersistence` is intentionally imported from the scoped
// `@firebase/auth` package rather than `firebase/auth`. The `firebase/auth`
// meta-package only declares node/browser/default export conditions (no
// `react-native`), so under Metro it resolves to the browser build where this
// symbol is missing — which previously forced the getAuth() fallback below and
// broke session persistence. `@firebase/auth` does declare a `react-native`
// condition (dist/rn) that includes getReactNativePersistence.
import { getReactNativePersistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Values pulled from app.json `expo.extra.firebase` if present, otherwise the
// PLACEHOLDER defaults below. Fill EITHER location in with your real config.
const extra = (Constants.expoConfig?.extra && Constants.expoConfig.extra.firebase) || {};

const firebaseConfig = {
  apiKey: extra.apiKey || 'AIzaSyB3daI3vF8wGQtZc8VLwwM3-KLMydNlzCo',
  authDomain: extra.authDomain || 'munchable-465d2.firebaseapp.com',
  projectId: extra.projectId || 'munchable-465d2',
  storageBucket: extra.storageBucket || 'munchable-465d2.firebasestorage.app',
  messagingSenderId: extra.messagingSenderId || '1046414203082',
  appId: extra.appId || '1:1046414203082:web:e942430d26f37e93de3c33',
  measurementId: extra.measurementId || 'G-SWBRWN3E8P',
};

// Initialize the app once (guard against Fast Refresh re-running this module).
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with React Native persistence so the session survives app
// restarts. `getReactNativePersistence` is provided by the firebase/auth
// "react-native" bundle (resolved by Metro). We wrap in try/catch because
// initializeAuth throws if it has already run (e.g. on Fast Refresh) and so we
// can gracefully fall back to plain getAuth if RN persistence is unavailable.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (err) {
  // Already initialized, or persistence not available in this environment.
  // Falls back to in-memory/default persistence; sessions still work for the
  // current app run and persistence can be revisited later if needed.
  auth = getAuth(app);
}

export { auth };
export default app;
