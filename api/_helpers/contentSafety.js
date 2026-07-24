/**
 * Lightweight UGC text safety checks (no external npm dependency).
 * Rejects severe profanity / abuse terms before Firestore writes.
 */

const BLOCKED_PATTERNS = [
  /\bf+u+c+k+\b/i,
  /\bs+h+i+t+\b/i,
  /\ba+s+s+h+o+l+e+\b/i,
  /\bb+i+t+c+h+\b/i,
  /\bn+i+g+g+[ae]r+\b/i,
  /\bc+u+n+t+\b/i,
  /\bf+a+g+g?o+t+\b/i,
  /\br+e+t+a+r+d+\b/i,
  /\bs+l+u+t+\b/i,
  /\bw+h+o+r+e+\b/i,
  /\bp+o+r+n+\b/i,
  /\bonlyfans\b/i,
  /\bk+i+l+l\s+y+o+u+r+s+e+l+f+\b/i,
  /\bkys\b/i,
];

/** Extra terms blocked in AI-generated recipe text / prompts. */
const AI_DANGER_PATTERNS = [
  /\bbleach\b/i,
  /\bantifreeze\b/i,
  /\bratroison\b/i,
  /\brat\s*poison\b/i,
  /\bcyanide\b/i,
  /\barsenic\b/i,
  /\braw\s+chicken\s+blood\b/i,
  /\bundercooked\s+pork\b/i,
  /\bpoison\b/i,
  /\btoxic\b/i,
  /\binedible\b/i,
  /\bnon[- ]?food\b/i,
];

function findMatch(text, patterns) {
  const value = String(text || '');
  if (!value.trim()) return null;
  for (const pattern of patterns) {
    if (pattern.test(value)) return pattern.toString();
  }
  return null;
}

function assertCleanText(text, { field = 'text', allowEmpty = true } = {}) {
  const value = String(text ?? '');
  if (!value.trim()) {
    if (allowEmpty) return value;
    const err = new Error(`${field} is required`);
    err.code = 'invalid_text';
    err.status = 400;
    throw err;
  }
  if (findMatch(value, BLOCKED_PATTERNS)) {
    const err = new Error(
      'That text contains language that is not allowed. Please revise and try again.'
    );
    err.code = 'profanity_blocked';
    err.status = 400;
    throw err;
  }
  return value;
}

function textContainsAiDanger(text) {
  return Boolean(findMatch(text, AI_DANGER_PATTERNS));
}

function filterAiSuggestionPayload(suggestion) {
  if (!suggestion || typeof suggestion !== 'object') return null;
  const blob = [
    suggestion.title,
    suggestion.description,
    suggestion.summary,
    ...(Array.isArray(suggestion.ingredients) ? suggestion.ingredients : []),
    ...(Array.isArray(suggestion.steps) ? suggestion.steps : []),
    ...(Array.isArray(suggestion.instructions) ? suggestion.instructions : []),
  ]
    .filter(Boolean)
    .join(' ');
  if (findMatch(blob, BLOCKED_PATTERNS) || findMatch(blob, AI_DANGER_PATTERNS)) {
    return null;
  }
  return suggestion;
}

module.exports = {
  assertCleanText,
  textContainsAiDanger,
  filterAiSuggestionPayload,
  BLOCKED_PATTERNS,
  AI_DANGER_PATTERNS,
};
