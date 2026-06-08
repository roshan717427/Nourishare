// Shared helpers for turning free-text recipe fields into ingredient/step lists.

const DELIMITER_RE = /\r?\n|•|·|;|\band\b|,(?![^(]*\))/i;

// Common food words used to split concatenated ingredient strings (longest first).
const KNOWN_INGREDIENTS = [
  'heavy cream', 'olive oil', 'cherry tomatoes', 'coconut milk', 'curry paste',
  'chili oil', 'lime crema', 'soft-boiled egg', 'san marzano tomatoes',
  'fresh mozzarella', 'pizza dough', 'corn tortillas', 'canned tomatoes',
  'red onion', 'parmesan', 'basil', 'garlic', 'cream', 'pasta', 'tomatoes',
  'quinoa', 'cucumber', 'feta', 'olives', 'lemon', 'ramen', 'noodles', 'broth',
  'miso', 'scallions', 'mushrooms', 'mozzarella', 'dough', 'fish', 'tortillas',
  'cabbage', 'cilantro', 'coconut', 'curry', 'tofu', 'chicken', 'ginger', 'rice',
  'onion', 'salt', 'pepper', 'butter', 'flour', 'sugar', 'egg', 'milk', 'oil',
];

function normalizeItem(item) {
  return `${item}`.trim().replace(/^[-–—•·]+\s*/, '');
}

function hasDelimiters(value) {
  return /[\r\n,;•·]|\band\b/i.test(value);
}

function splitConcatenatedIngredients(value) {
  const lower = value.toLowerCase();
  const parts = [];
  let remaining = lower;
  const sorted = [...KNOWN_INGREDIENTS].sort((a, b) => b.length - a.length);

  while (remaining.length > 0) {
    let matched = false;
    for (const word of sorted) {
      if (remaining.startsWith(word)) {
        parts.push(word);
        remaining = remaining.slice(word.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Skip stray characters or grab the next chunk up to the next known word.
      const nextIdx = sorted
        .map((w) => remaining.indexOf(w))
        .filter((i) => i > 0)
        .sort((a, b) => a - b)[0];
      if (nextIdx != null) {
        parts.push(remaining.slice(0, nextIdx).trim());
        remaining = remaining.slice(nextIdx);
      } else {
        parts.push(remaining.trim());
        break;
      }
    }
  }

  return parts.map(normalizeItem).filter(Boolean);
}

function splitBySpaces(value) {
  // Space-separated lists like "pasta garlic cream parmesan"
  const words = value.split(/\s+/).map(normalizeItem).filter(Boolean);
  if (words.length >= 2 && words.every((w) => w.length >= 2 && w.length <= 24)) {
    return words;
  }
  return null;
}

export function toIngredientList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) => toIngredientList(v)).filter(Boolean);
  }

  const raw = `${value}`.trim();
  if (!raw) return [];

  if (hasDelimiters(raw)) {
    return raw
      .split(DELIMITER_RE)
      .map(normalizeItem)
      .filter(Boolean);
  }

  if (/\s{2,}/.test(raw)) {
    return raw.split(/\s{2,}/).map(normalizeItem).filter(Boolean);
  }

  const spaceSplit = splitBySpaces(raw);
  if (spaceSplit) return spaceSplit;

  // No delimiters — try greedy known-ingredient splitting (e.g. "pastagarliccream").
  if (raw.length > 8 && !/\s/.test(raw)) {
    const split = splitConcatenatedIngredients(raw);
    if (split.length > 1) return split;
  }

  return [raw];
}

const STEP_NUMBER_RE = /^\s*\d+[\.\):\-]\s*/;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z])/;

export function toStepList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) => toStepList(v)).filter(Boolean);
  }

  const raw = `${value}`.trim();
  if (!raw) return [];

  // Already numbered lines ("1. Boil water\n2. Add pasta")
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.some((l) => STEP_NUMBER_RE.test(l))) {
    return lines.map((l) => l.replace(STEP_NUMBER_RE, '').trim()).filter(Boolean);
  }

  if (lines.length > 1) {
    return lines.map(normalizeItem).filter(Boolean);
  }

  // Semicolon-separated steps
  if (raw.includes(';')) {
    const parts = raw.split(';').map(normalizeItem).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  // Sentence boundaries ("Boil water. Add pasta. Drain and serve.")
  const sentences = raw.split(SENTENCE_SPLIT_RE).map(normalizeItem).filter(Boolean);
  if (sentences.length > 1) return sentences;

  return [raw];
}

export function getRecipeSteps(recipe) {
  const explicit = toStepList(recipe.steps || recipe.instructions);
  if (explicit.length > 0) return explicit;
  return toStepList(recipe.cooking_notes || recipe.notes || recipe.description);
}
