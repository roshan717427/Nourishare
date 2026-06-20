import re

USERNAME_RE = re.compile(r'^[a-z0-9_.]{3,30}$')
MAX_PANTRY_ITEMS = 50
MAX_LIMIT = 50


def normalize_username(raw):
    if raw is None:
        return None
    value = str(raw).strip().lower()
    return value if USERNAME_RE.match(value) else None


def sanitize_pantry_ingredients(raw):
    if not isinstance(raw, list):
        return None
    out = []
    for item in raw[:MAX_PANTRY_ITEMS]:
        cleaned = str(item or '').strip()
        if cleaned:
            out.append(cleaned[:100])
    return out or None


def validate_limit(raw, default_limit=10, max_limit=MAX_LIMIT):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default_limit
    if value < 1:
        return default_limit
    return min(value, max_limit)
