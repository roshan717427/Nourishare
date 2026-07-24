import { authFetch } from './apiAuth';
import { API_URL } from '../config/api';
import { httpError } from './errorMessages';

const BASE = `${API_URL}/aiSuggestions`;
const GENERATE_TIMEOUT_MS = 45000;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await authFetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Request timed out');
      timeoutErr.code = 'timeout';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadCachedSuggestions(username) {
  const params = new URLSearchParams({
    action: 'loadCached',
    username,
  });
  const response = await authFetch(`${BASE}?${params}`, { method: 'GET' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response, data);
  }
  return data;
}

export async function generateSuggestions(username, pantryIngredients = null) {
  const body = { username };
  if (Array.isArray(pantryIngredients) && pantryIngredients.length > 0) {
    body.pantry_ingredients = pantryIngredients;
  }
  const response = await fetchWithTimeout(
    `${BASE}?action=generate`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    GENERATE_TIMEOUT_MS
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response, data);
  }
  return data;
}

export async function hideSuggestion(username, recipeId) {
  const response = await authFetch(`${BASE}?action=hide`, {
    method: 'POST',
    body: JSON.stringify({ username, recipeId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response, data);
  }
  return data;
}
