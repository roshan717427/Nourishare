"""Shared internal-service authentication for the Python serverless handlers.

These endpoints are invoked server-to-server (e.g. the Node AI suggestions
function calls /api/getSuggestions for its rule-based fallback) and have no
end-user Firebase token to verify. Instead they require a shared secret passed
in the `x-internal-secret` header that must match the INTERNAL_API_SECRET
environment variable.

IMPORTANT (deployment): INTERNAL_API_SECRET must be configured in Vercel for
both the Python endpoints AND the Node callers. The check fails CLOSED — if the
env var is unset/empty, EVERY request is rejected (including the internal
caller), so the variable is required for the call path to work at all.
"""
import hmac
import os

INTERNAL_SECRET_HEADER = 'x-internal-secret'


def is_internal_request(headers):
    """True only when the request carries a valid internal-service secret.

    Uses a constant-time comparison to avoid leaking the secret via timing.
    Returns False when INTERNAL_API_SECRET is unset (fail closed).
    """
    expected = os.environ.get('INTERNAL_API_SECRET')
    if not expected:
        return False
    provided = ''
    if headers is not None:
        provided = headers.get(INTERNAL_SECRET_HEADER) or ''
    return hmac.compare_digest(str(provided), str(expected))
