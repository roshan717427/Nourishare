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
import { normalizeUsername } from '../utils/apiAuth';
import { withAuthHeaders } from '../utils/apiAuth';

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

  const signUp = async ({ email, password, username: chosenUsername }) => {
    const normalized = normalizeUsername(chosenUsername);
    if (!normalized) {
      const err = new Error('Invalid username');
      err.code = 'auth/invalid-username';
      throw err;
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    usernameOverrides.current[credential.user.uid] = normalized;
    await updateProfile(credential.user, { displayName: normalized });
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
