import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { API_URL } from '../config/api';
import { normalizeUsername, withAuthHeaders, authFetch } from '../utils/apiAuth';

const AuthContext = createContext({
  user: null,
  initializing: true,
  following: [],
  pendingRequests: [],
  signIn: () => {},
  signUp: () => {},
  signOut: () => {},
  follow: () => {},
  unfollow: () => {},
  requestFollow: () => {},
  cancelFollowRequest: () => {},
  isFollowing: () => false,
  isPendingRequest: () => false,
  refreshSocialState: () => {},
});

function usernameKey(value) {
  return (value || '').toLowerCase();
}

function mapFirebaseUser(fbUser, usernameOverride) {
  if (!fbUser) return null;
  const username =
    normalizeUsername(usernameOverride) ||
    normalizeUsername(fbUser.displayName) ||
    null;
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    username,
    name: fbUser.displayName || username || fbUser.email,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [following, setFollowing] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const usernameOverrides = useRef({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const override = fbUser ? usernameOverrides.current[fbUser.uid] : undefined;
      setUser(mapFirebaseUser(fbUser, override));
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Resolve username from the server when Firebase displayName is missing or invalid
  // (e.g. legacy accounts or email-as-displayName). Meal logging already works via
  // server-side uid/email lookup; profile needs the same identity on the client.
  useEffect(() => {
    if (initializing || !user?.uid || user?.username) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch(`${API_URL}/getUserProfile?me=1`);
        if (cancelled || !response.ok) return;
        const profile = await response.json();
        const resolved = normalizeUsername(profile?.username);
        if (!resolved || !auth.currentUser) return;
        usernameOverrides.current[auth.currentUser.uid] = resolved;
        setUser(mapFirebaseUser(auth.currentUser, resolved));
      } catch (err) {
        console.log('Could not resolve username from profile:', err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.username, initializing]);

  const username = user?.username;

  const refreshSocialState = useCallback(async () => {
    if (!username) return;

    try {
      const headers = await withAuthHeaders();
      const [followingRes, pendingRes] = await Promise.all([
        fetch(
          `${API_URL}/social?action=following&username=${encodeURIComponent(username)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        ),
        fetch(
          `${API_URL}/social?action=sentFollowRequests&username=${encodeURIComponent(username)}`,
          { method: 'GET', headers }
        ),
      ]);

      if (followingRes.ok) {
        const data = await followingRes.json();
        if (data && Array.isArray(data.following)) {
          const fromServer = data.following
            .map((item) => (typeof item === 'string' ? item : item?.username))
            .filter(Boolean);
          setFollowing(fromServer);
        }
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        if (data && Array.isArray(data.pending)) {
          setPendingRequests(data.pending.map((item) => item.username).filter(Boolean));
        }
      }
    } catch (err) {
      console.log('Could not refresh social state:', err.message);
    }
  }, [username]);

  useEffect(() => {
    if (!username) {
      setFollowing([]);
      setPendingRequests([]);
      return;
    }
    refreshSocialState();
  }, [username, refreshSocialState]);

  const signIn = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async ({ email, password, username: chosenUsername, firstName, lastName }) => {
    const normalized = normalizeUsername(chosenUsername);
    if (!normalized) {
      const err = new Error('Invalid username');
      err.code = 'auth/invalid-username';
      throw err;
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    usernameOverrides.current[credential.user.uid] = normalized;
    await updateProfile(credential.user, { displayName: firstName + ' ' + lastName});
    await credential.user.reload();
    await credential.user.getIdToken(true);
    setUser(mapFirebaseUser(credential.user, normalized));
    return credential;
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } finally {
      setUser(null);
      setFollowing([]);
      setPendingRequests([]);
    }
  };

  const follow = (targetUsername) => {
    if (!targetUsername) return;
    const key = usernameKey(targetUsername);
    setFollowing((prev) =>
      prev.some((u) => usernameKey(u) === key) ? prev : [...prev, targetUsername]
    );
    setPendingRequests((prev) => prev.filter((u) => usernameKey(u) !== key));
  };

  const unfollow = (targetUsername) => {
    const key = usernameKey(targetUsername);
    setFollowing((prev) => prev.filter((u) => usernameKey(u) !== key));
  };

  const requestFollow = (targetUsername) => {
    if (!targetUsername) return;
    const key = usernameKey(targetUsername);
    setPendingRequests((prev) =>
      prev.some((u) => usernameKey(u) === key) ? prev : [...prev, targetUsername]
    );
  };

  const cancelFollowRequest = (targetUsername) => {
    const key = usernameKey(targetUsername);
    setPendingRequests((prev) => prev.filter((u) => usernameKey(u) !== key));
  };

  const isFollowing = (targetUsername) =>
    following.some((u) => usernameKey(u) === usernameKey(targetUsername));

  const isPendingRequest = (targetUsername) =>
    pendingRequests.some((u) => usernameKey(u) === usernameKey(targetUsername));

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        following,
        pendingRequests,
        signIn,
        signUp,
        signOut,
        follow,
        unfollow,
        requestFollow,
        cancelFollowRequest,
        isFollowing,
        isPendingRequest,
        refreshSocialState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
