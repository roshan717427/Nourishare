import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { API_URL } from '../config/api';

const AuthContext = createContext({
  user: null,
  initializing: true,
  following: [],
  signIn: () => {},
  signUp: () => {},
  signOut: () => {},
  follow: () => {},
  unfollow: () => {},
  isFollowing: () => false,
});

// Firebase auth keys off email, but the app's social features key off a public
// `username`. We set the Firebase `displayName` to the chosen username at
// sign-up, so we map it back here. We also keep a short-lived override keyed by
// uid so the in-app `user` always has the right username even before
// `onAuthStateChanged` re-reads the freshly-set displayName.
function mapFirebaseUser(fbUser, usernameOverride) {
  if (!fbUser) return null;
  const username = usernameOverride || fbUser.displayName || fbUser.email;
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    username,
    name: fbUser.displayName || username,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [following, setFollowing] = useState([]);
  // uid -> username chosen at sign-up, applied while displayName propagates.
  const usernameOverrides = useRef({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const override = fbUser ? usernameOverrides.current[fbUser.uid] : undefined;
      setUser(mapFirebaseUser(fbUser, override));
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Hydrate the persisted following list whenever a username becomes available
  // (login / session restore). The backend (GET /api/social?action=following)
  // is the source of truth at startup; optimistic follow/unfollow updates
  // happen on top of this for the rest of the session. That action returns
  // following as objects ({ username, name, timestamp }), so we map down to the
  // bare usernames the rest of the social state works with.
  const username = user?.username;
  useEffect(() => {
    if (!username) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${API_URL}/social?action=following&username=${encodeURIComponent(username)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data && Array.isArray(data.following)) {
          setFollowing(
            data.following
              .map((item) => (typeof item === 'string' ? item : item?.username))
              .filter(Boolean)
          );
        }
      } catch (err) {
        // Offline / no backend: keep whatever local follow state exists
        console.log('Could not load following list:', err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  // Sign in with email + password. Throws on failure so the calling screen can
  // surface the error via Alert. `user` is updated by onAuthStateChanged.
  const signIn = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Create an account with email + password and set the Firebase displayName to
  // the chosen username. Throws on failure so the screen can Alert. The
  // Firestore profile is created separately by SignUpScreen via the existing
  // POST /api/createUserProfile call.
  const signUp = async ({ email, password, username }) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (username) {
      usernameOverrides.current[credential.user.uid] = username;
      await updateProfile(credential.user, { displayName: username });
      // Reflect the username immediately rather than waiting for a re-auth.
      setUser(mapFirebaseUser(credential.user, username));
    }
    return credential;
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } finally {
      // onAuthStateChanged will clear `user`, but clear here too for immediacy
      // and reset social state exactly as before.
      setUser(null);
      setFollowing([]);
    }
  };

  const follow = (username) => {
    if (!username) return;
    setFollowing((prev) => (prev.includes(username) ? prev : [...prev, username]));
  };

  const unfollow = (username) => {
    setFollowing((prev) => prev.filter((u) => u !== username));
  };

  const isFollowing = (username) => following.includes(username);

  return (
    <AuthContext.Provider
      value={{ user, initializing, following, signIn, signUp, signOut, follow, unfollow, isFollowing }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
