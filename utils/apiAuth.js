import { auth } from '../config/firebase';

const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export function normalizeUsername(raw) {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim().toLowerCase();
  return USERNAME_RE.test(value) ? value : null;
}

export async function getFreshIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function withAuthHeaders(extraHeaders = {}, { forceRefresh = false } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const token = await getFreshIdToken(forceRefresh);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Authenticated fetch with automatic token refresh on 401.
 * Throws AuthError when the session cannot be recovered.
 */
export async function authFetch(url, options = {}) {
  const { headers: extraHeaders, ...rest } = options;

  const makeRequest = async (forceRefresh) => {
    const headers = await withAuthHeaders(extraHeaders, { forceRefresh });
    return fetch(url, { ...rest, headers });
  };

  let response = await makeRequest(false);

  if (response.status === 401) {
    response = await makeRequest(true);
  }

  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    throw new AuthError(data.error || 'Session expired. Please sign in again.');
  }

  return response;
}
