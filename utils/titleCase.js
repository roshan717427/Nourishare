/**
 * Title-case helpers for user-entered profile labels (cuisines, ingredients).
 * "italian" → "Italian", "chicken breast" → "Chicken Breast"
 */

function toTitleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function capitalizeList(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => toTitleCase(item)).filter(Boolean);
}

module.exports = {
  toTitleCase,
  capitalizeList,
};
