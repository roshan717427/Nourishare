const PERSON_NAME_RE = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const PASSWORD_SPECIAL_RE = /[!@#$%^&*]/;
const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

export const PASSWORD_HINT = '8+ chars, upper, lower, !@#$%^&*';
export const USERNAME_HINT = '3-30 chars: letters, nums, periods, and/or underscores';

export function validatePersonName(name, fieldLabel = 'Name') {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return `Please enter your ${fieldLabel.toLowerCase()}.`;
  }
  if (!PERSON_NAME_RE.test(trimmed)) {
    return `${fieldLabel} must contain letters only (A–Z).`;
  }
  return null;
}

export function validateUsername(username) {
  const trimmed = (username || '').trim().toLowerCase();
  if (!trimmed) {
    return 'Please choose a username.';
  }
  if (!USERNAME_RE.test(trimmed)) {
    return USERNAME_HINT;
  }
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!PASSWORD_SPECIAL_RE.test(password)) {
    return 'Password must include at least one special character (!@#$%^&*).';
  }
  return null;
}
