import { API_URL } from '../config/api';
import { authFetch } from './apiAuth';

const BASE = `${API_URL}/mealPlan`;

export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getWeekRange(weekStart) {
  const start = startOfWeek(weekStart);
  const end = addDays(start, 6);
  return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
}

export async function fetchMealPlan(username, startDate, endDate) {
  const params = new URLSearchParams({ action: 'getMealPlan', username, startDate, endDate });
  const response = await authFetch(`${BASE}?${params}`, { method: 'GET' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load meal plan');
  }
  const data = await response.json();
  return data.entries || [];
}

export async function scheduleRecipe(username, date, recipe) {
  const response = await authFetch(`${BASE}?action=scheduleRecipe`, {
    method: 'POST',
    body: JSON.stringify({
      username,
      date,
      recipeId: recipe.id,
      recipeName: recipe.name,
      ingredients: recipe.ingredients || '',
      image: recipe.image || null,
      difficulty_level: recipe.difficulty_level || null,
      cooking_time: recipe.cooking_time || null,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to schedule recipe');
  }
  const data = await response.json();
  return data.entry;
}

export async function moveMealPlanEntry(username, entryId, newDate) {
  const response = await authFetch(`${BASE}?action=moveMealPlanEntry`, {
    method: 'POST',
    body: JSON.stringify({ username, entryId, newDate }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to move entry');
  }
  const data = await response.json();
  return data.entry;
}

export async function removeMealPlanEntry(username, entryId) {
  const response = await authFetch(`${BASE}?action=removeMealPlanEntry`, {
    method: 'POST',
    body: JSON.stringify({ username, entryId }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to remove entry');
  }
}

export async function fetchShoppingList(username, startDate, endDate) {
  const params = new URLSearchParams({ action: 'shoppingList', username, startDate, endDate });
  const response = await authFetch(`${BASE}?${params}`, { method: 'GET' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load shopping list');
  }
  return response.json();
}

export function groupEntriesByDate(entries) {
  const map = {};
  for (const entry of entries) {
    if (!entry.date) continue;
    if (!map[entry.date]) map[entry.date] = [];
    map[entry.date].push(entry);
  }
  return map;
}
