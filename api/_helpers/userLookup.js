const { FieldPath } = require('firebase-admin/firestore');
const { normalizeUsername } = require('./validateInput');

/** Firestore `in` / `documentId in` supports up to 30 values. */
const IN_QUERY_LIMIT = 30;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function uniqueNormalizedUsernames(rawUsernames) {
  const usernames = [];
  const seen = new Set();
  for (const entry of rawUsernames || []) {
    const username = normalizeUsername(entry);
    if (username && !seen.has(username)) {
      seen.add(username);
      usernames.push(username);
    }
  }
  return usernames;
}

async function partitionExistingUsernames(db, rawUsernames) {
  const usernames = uniqueNormalizedUsernames(rawUsernames);

  const docs = await Promise.all(
    usernames.map((u) => db.collection('users').doc(u).get())
  );

  const existing = [];
  const missing = [];
  usernames.forEach((u, i) => {
    if (docs[i].exists) existing.push(u);
    else missing.push(u);
  });

  return { existing, missing };
}

/**
 * Batch-load user docs by username (doc id) via chunked `documentId in` queries.
 * Returns a Map of username -> Firestore data (or empty object if missing).
 */
async function fetchUsersByUsernames(db, rawUsernames) {
  const usernames = uniqueNormalizedUsernames(rawUsernames);
  const byId = new Map();
  if (usernames.length === 0) return byId;

  for (const batch of chunk(usernames, IN_QUERY_LIMIT)) {
    const snap = await db
      .collection('users')
      .where(FieldPath.documentId(), 'in', batch)
      .get();
    snap.forEach((doc) => {
      byId.set(doc.id, doc.exists ? doc.data() || {} : {});
    });
  }

  return byId;
}

module.exports = {
  partitionExistingUsernames,
  fetchUsersByUsernames,
  IN_QUERY_LIMIT,
};
