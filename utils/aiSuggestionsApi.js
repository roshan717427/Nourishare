import { authFetch } from './apiAuth';
import { API_URL } from '../config/api';
import { httpError } from './errorMessages';

const BASE = `${API_URL}/aiSuggestions`;

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
  const response = await authFetch(`${BASE}?action=generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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
