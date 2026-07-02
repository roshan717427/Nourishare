// Centralized, user-facing error copy.
//
// The golden rule: users should NEVER see raw technical detail (HTTP status
// codes, `err.message`, backend error strings, JSON parse errors, "Network
// request failed", etc.). Translate everything into clear, friendly,
// plain-English copy here so the whole app stays consistent.
//
// Backend responses keep their `{ error: "..." }` body and status codes for
// debugging/logging — the FRONTEND is responsible for the friendly translation.

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const NETWORK_ERROR = "Couldn't connect. Check your internet and try again.";
export const SESSION_ERROR = 'Please sign in again to continue.';
export const SERVER_ERROR = 'Our servers are having trouble. Please try again shortly.';

// AI suggestion generation limits (Gemini + app daily quota)
export const AI_DAILY_LIMIT =
  'You have used your 3 generations for today. Please try again tomorrow!';
export const AI_SERVICE_BUSY =
  "Suggestions are unavailable right now (not your limit, the service is busy). Please try again shortly.";
export const AI_RPM_LIMIT =
  'Suggestions are popular right now! Please try again in a minute.';
export const AI_GENERATION_FAILED =
  "We couldn't generate new suggestions right now. Please try again shortly.";

const STATUS_MESSAGES = {
  400: "Something doesn't look right. Please check your input and try again.",
  401: SESSION_ERROR,
  403: "You don't have access to this.",
  404: "We couldn't find what you were looking for.",
  409: "That's already been done.",
  429: "You're doing that too fast. Please wait a moment and try again.",
};

function resolveOverride(overrides, key) {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key];
  }
  return undefined;
}

// Map an HTTP status code to a friendly message. Callers may pass `overrides`
// keyed by status code (e.g. { 403: 'You need to follow this user to do that.' }),
// '5xx' for any server error, or 'default' for the non-specific fallback.
export function messageForStatus(status, overrides = {}) {
  const override = resolveOverride(overrides, status);
  if (override) return override;

  if (typeof status === 'number' && status >= 500) {
    return resolveOverride(overrides, '5xx') || SERVER_ERROR;
  }

  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];

  return resolveOverride(overrides, 'default') || GENERIC_ERROR;
}

// Best-effort detection of connectivity / fetch-layer failures (these throw a
// TypeError with messages like "Network request failed" in React Native).
function isNetworkError(err) {
  if (!err) return false;
  if (err.name === 'TypeError') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('connection')
  );
}

// Build an Error that carries the HTTP status (and keeps the backend's
// technical message for console logging) so a downstream catch block can map it
// to friendly copy via friendlyError(). Use in place of
// `throw new Error(data.error || 'Failed to ...')`.
export function httpError(response, data) {
  const technical =
    (data && (data.error || data.message)) ||
    `Request failed with status ${response && response.status != null ? response.status : 'unknown'}`;
  const err = new Error(technical);
  if (response && typeof response.status === 'number') err.status = response.status;
  err.data = data;
  return err;
}

// Primary entry point for catch blocks. Returns a friendly, plain-English
// string and NEVER leaks raw error/backend text.
//
// options:
//   - status:    explicit HTTP status, if known (otherwise read from err.status)
//   - fallback:  context-specific copy to use when no status/network match
//   - overrides: per-status overrides (see messageForStatus)
export function friendlyError(err, options = {}) {
  const { fallback, overrides } = options;
  const mergedOverrides = { ...(overrides || {}) };
  if (fallback && mergedOverrides.default == null) {
    mergedOverrides.default = fallback;
  }

  const status = options.status != null ? options.status : err && err.status;
  if (typeof status === 'number') {
    return messageForStatus(status, mergedOverrides);
  }

  if (err && err.name === 'AuthError') {
    return resolveOverride(mergedOverrides, 401) || SESSION_ERROR;
  }

  if (isNetworkError(err)) {
    return resolveOverride(mergedOverrides, 'network') || NETWORK_ERROR;
  }

  return fallback || GENERIC_ERROR;
}

// Convenience for places that have a fetch Response (rather than a thrown
// error) in scope and want the friendly copy for its status code.
export function friendlyErrorForResponse(response, options = {}) {
  const { fallback, overrides } = options;
  const mergedOverrides = { ...(overrides || {}) };
  if (fallback && mergedOverrides.default == null) {
    mergedOverrides.default = fallback;
  }
  return messageForStatus(response && response.status, mergedOverrides);
}

// Map structured AI suggestion error codes from the backend to friendly copy.
export function messageForAiErrorCode(code) {
  switch (code) {
    case 'daily_limit_exceeded':
      return AI_DAILY_LIMIT;
    case 'gemini_rate_limit_rpd':
      // The shared AI service hit its own daily quota — distinct from this
      // user's personal 3/day cap, which is untouched (and refunded server-side).
      return AI_SERVICE_BUSY;
    case 'gemini_rate_limit_rpm':
      return AI_RPM_LIMIT;
    case 'generation_failed':
    case 'generation_empty':
    case 'gemini_error':
    case 'gemini_unavailable':
    case 'gemini_empty':
      return AI_GENERATION_FAILED;
    default:
      return null;
  }
}

// Resolve friendly copy for AI API errors (thrown httpError or raw response data).
export function friendlyAiError(err, options = {}) {
  const code =
    (err && err.data && (err.data.code || err.data.error)) ||
    (err && err.code) ||
    null;
  const fromCode = messageForAiErrorCode(code);
  if (fromCode) return fromCode;
  return friendlyError(err, {
    fallback: AI_GENERATION_FAILED,
    overrides: {
      429: AI_RPM_LIMIT,
      ...(options.overrides || {}),
    },
    ...options,
  });
}
