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
import {
  registerForPushNotificationsAsync,
  addPushTokenListener,
} from '../utils/pushNotifications';

const AuthContext = createContext({
  user: null,
  initializing: true,
  profileStatus: 'unknown',
  following: [],
  pendingRequests: [],
  signIn: () => {},
  signUp: () => {},
  signOut: () => {},
  completeProfileSetup: () => {},
  markProfileReady: () => {},
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
  const [profileStatus, setProfileStatus] = useState('unknown');
  const [following, setFollowing] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const usernameOverrides = useRef({});
  const profileReadyRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const override = fbUser ? usernameOverrides.current[fbUser.uid] : undefined;
      setUser(mapFirebaseUser(fbUser, override));
      setInitializing(false);
      if (!fbUser) {
        setProfileStatus('unknown');
        profileReadyRef.current = false;
      }
    });
    return unsubscribe;
  }, []);

  // Confirm profile exists on the server (signed-in users only).
  useEffect(() => {
    if (initializing || !user?.uid) {
      if (!user) setProfileStatus('unknown');
      return;
    }

    let cancelled = false;
    profileReadyRef.current = false;
    setProfileStatus('checking');

    const applyReady = (profile) => {
      const resolved = normalizeUsername(profile?.username);
      if (resolved && auth.currentUser) {
        usernameOverrides.current[auth.currentUser.uid] = resolved;
        setUser(mapFirebaseUser(auth.currentUser, resolved));
      }
      profileReadyRef.current = true;
      setProfileStatus('ready');
    };

    const applyNeedsSetup = () => {
      if (profileReadyRef.current || cancelled) return;
      setProfileStatus('needs_setup');
    };

    (async () => {
      // Poll the profile a few times before falling back to the setup screen.
      // Signup may still be creating the profile, and a transient network/auth
      // hiccup should never bounce an existing user into "finish setup".
      const MAX_ATTEMPTS = 4;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (cancelled || profileReadyRef.current) return;
        try {
          const response = await authFetch(`${API_URL}/getUserProfile?me=1`);
          if (cancelled || profileReadyRef.current) return;

          if (response.ok) {
            const profile = await response.json();
            applyReady(profile);
            return;
          }

          // Only a definitive "no profile yet" (404 needsSetup) is a setup
          // signal; other statuses are treated as transient and retried.
          if (response.status !== 404) {
            const data = await response.json().catch(() => ({}));
            if (!data.needsSetup) throw new Error(`status ${response.status}`);
          }
        } catch (err) {
          console.log('Could not check profile status:', err.message);
        }

        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      applyNeedsSetup();
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, initializing]);

  const username = user?.username;

  const refreshSocialState = useCallback(async () => {
    if (!username) return;

    try {
      const headers = await withAuthHeaders();
      const [followingRes, pendingRes] = await Promise.all([
        fetch(
          `${API_URL}/social?action=following&username=${encodeURIComponent(username)}`,
          { method: 'GET', headers }
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

  // Register this device's Expo push token with the backend once the user has a
  // resolved username, and keep it current if Expo rotates the token. All
  // failures are swallowed so push setup never blocks the signed-in experience.
  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    const uploadToken = async (token) => {
      if (!token || cancelled) return;
      try {
        await authFetch(`${API_URL}/social?action=registerPushToken`, {
          method: 'POST',
          body: JSON.stringify({ username, token }),
        });
      } catch (err) {
        console.log('Could not register push token:', err.message);
      }
    };

    (async () => {
      const token = await registerForPushNotificationsAsync();
      await uploadToken(token);
    })();

    const subscription = addPushTokenListener((token) => {
      uploadToken(token);
    });

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, [username]);

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
      setProfileStatus('unknown');
      setFollowing([]);
      setPendingRequests([]);
    }
  };

  const completeProfileSetup = async ({ username: chosenUsername, firstName, lastName }) => {
    const normalized = normalizeUsername(chosenUsername);
    if (!normalized) {
      const err = new Error('Invalid username');
      err.code = 'auth/invalid-username';
      throw err;
    }

    const email = user?.email || auth.currentUser?.email;
    if (!email) {
      throw new Error('No email on account. Please sign out and sign in again.');
    }

    const usernameRes = await fetch(
      `${API_URL}/social?action=checkUsername&username=${encodeURIComponent(normalized)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (usernameRes.ok) {
      const { exists } = await usernameRes.json();
      if (exists) {
        const err = new Error('Username already taken');
        err.code = 'auth/username-already-exists';
        throw err;
      }
    }

    const profile = {
      username: normalized,
      name: `${firstName.trim()} ${lastName.trim()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    };

    const headers = await withAuthHeaders({}, { forceRefresh: true });
    const profileResponse = await fetch(`${API_URL}/createUserProfile`, {
      method: 'POST',
      headers,
      body: JSON.stringify(profile),
    });

    if (!profileResponse.ok) {
      const data = await profileResponse.json().catch(() => ({}));
      if (
        profileResponse.status === 409 &&
        data.error === 'User profile already exists'
      ) {
        const refresh = await authFetch(`${API_URL}/getUserProfile?me=1`);
        if (refresh.ok) {
          const existing = await refresh.json();
          const resolved = normalizeUsername(existing?.username);
          if (resolved && auth.currentUser) {
            usernameOverrides.current[auth.currentUser.uid] = resolved;
            setUser(mapFirebaseUser(auth.currentUser, resolved));
            setProfileStatus('ready');
            profileReadyRef.current = true;
            return;
          }
        }
        const err = new Error('Username already taken');
        err.code = 'auth/username-already-exists';
        throw err;
      }
      throw new Error(data.error || 'Failed to create profile');
    }

    if (auth.currentUser) {
      usernameOverrides.current[auth.currentUser.uid] = normalized;
      setUser(mapFirebaseUser(auth.currentUser, normalized));
    }
    profileReadyRef.current = true;
    setProfileStatus('ready');
  };

  const markProfileReady = useCallback((chosenUsername) => {
    const normalized = normalizeUsername(chosenUsername);
    if (normalized && auth.currentUser) {
      usernameOverrides.current[auth.currentUser.uid] = normalized;
      setUser(mapFirebaseUser(auth.currentUser, normalized));
    }
    profileReadyRef.current = true;
    setProfileStatus('ready');
  }, []);

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
        profileStatus,
        following,
        pendingRequests,
        signIn,
        signUp,
        signOut,
        completeProfileSetup,
        markProfileReady,
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
