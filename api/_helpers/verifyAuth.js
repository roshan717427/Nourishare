const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { normalizeUsername } = require('./validateInput');

async function resolveUsernameFromToken(decoded) {
  const fromDisplayName = normalizeUsername(decoded.name);
  if (fromDisplayName) return fromDisplayName;

  const db = getFirestore();

  if (decoded.uid) {
    const uidSnapshot = await db
      .collection('users')
      .where('uid', '==', decoded.uid)
      .limit(1)
      .get();
    if (!uidSnapshot.empty) {
      const doc = uidSnapshot.docs[0];
      return normalizeUsername(doc.id) || normalizeUsername(doc.data().username);
    }
  }

  if (!decoded.email) return null;

  const snapshot = await db
    .collection('users')
    .where('email', '==', decoded.email)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return normalizeUsername(doc.id) || normalizeUsername(doc.data().username);
}

async function verifyToken(req) {
  const token = extractBearerToken(req);
  if (!token) {
    return { error: 'authentication_required', status: 401 };
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email, decoded };
  } catch {
    return { error: 'invalid_token', status: 401 };
  }
}

async function requireToken(req, res) {
  const result = await verifyToken(req);
  if (result.error) {
    const message =
      result.error === 'authentication_required'
        ? 'Authentication required'
        : 'Invalid or expired token';
    res.status(result.status).json({ error: message });
    return null;
  }
  return result;
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

async function verifyAuth(req) {
  const token = extractBearerToken(req);
  if (!token) {
    return { error: 'authentication_required', status: 401 };
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const username = await resolveUsernameFromToken(decoded);
    if (!username) {
      return { error: 'invalid_token_identity', status: 401 };
    }
    return { uid: decoded.uid, username, decoded };
  } catch {
    return { error: 'invalid_token', status: 401 };
  }
}

async function requireAuth(req, res) {
  const result = await verifyAuth(req);
  if (result.error) {
    const message =
      result.error === 'authentication_required'
        ? 'Authentication required'
        : 'Invalid or expired token';
    res.status(result.status).json({ error: message });
    return null;
  }
  return result;
}

async function requireAuthForUsername(req, res, claimedUsername) {
  const claimed = normalizeUsername(claimedUsername);
  if (!claimed) {
    res.status(400).json({ error: 'Invalid username' });
    return null;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return null;

  if (auth.username !== claimed) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return auth;
}

module.exports = {
  verifyAuth,
  requireAuth,
  requireAuthForUsername,
  resolveUsernameFromToken,
  verifyToken,
  requireToken,
};
