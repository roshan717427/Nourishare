/**
 * Client-side mirror of api/_helpers/contentSafety for signup validation.
 * Keep patterns in sync with the server helper.
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

export function findBlockedLanguage(text) {
  const value = String(text || '');
  if (!value.trim()) return false;
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

export const BLOCKED_LANGUAGE_MESSAGE =
  'That text contains language that is not allowed. Please revise and try again.';
