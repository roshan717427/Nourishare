/**
 * External (push) notifications via the Expo Push API.
 *
 * Push tokens are stored OUTSIDE the public `users` document (which
 * getUserProfile returns wholesale to other users) so they are never exposed:
 *   push_tokens/{username} -> { tokens: [ExponentPushToken[...]], updatedAt }
 *
 * `sendInteractionNotification` is intentionally failure-tolerant: it swallows
 * every error so a failed push can never break the underlying social action
 * (a like/comment/follow must still succeed even if the push fails). It also
 * skips self-notifications (recipient === actor) and recipients with no token.
 */
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { normalizeUsername } = require('./validateInput');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TOKENS_COLLECTION = 'push_tokens';
const EXPO_BATCH_SIZE = 100;

function isExpoPushToken(token) {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getPushTokens(db, username) {
  const doc = await db.collection(PUSH_TOKENS_COLLECTION).doc(username).get();
  if (!doc.exists) return [];
  const tokens = doc.data().tokens;
  return Array.isArray(tokens) ? tokens.filter(isExpoPushToken) : [];
}

// Persist a token for a user, de-duplicated via arrayUnion. Returns false for
// tokens that don't look like Expo push tokens so callers can 400.
async function storePushToken(db, username, token) {
  if (!isExpoPushToken(token)) return false;
  await db
    .collection(PUSH_TOKENS_COLLECTION)
    .doc(username)
    .set(
      { tokens: FieldValue.arrayUnion(token), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  return true;
}

async function removePushToken(db, username, token) {
  if (!isExpoPushToken(token)) return false;
  await db
    .collection(PUSH_TOKENS_COLLECTION)
    .doc(username)
    .set(
      { tokens: FieldValue.arrayRemove(token), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  return true;
}

// Resolve a user's display name the same way the rest of the social API does
// (users/{username}.name), falling back to the username.
async function resolveDisplayName(db, username) {
  try {
    const doc = await db.collection('users').doc(username).get();
    if (doc.exists) return doc.data().name || username;
  } catch (err) {
    console.log('resolveDisplayName failed:', err.message);
  }
  return username;
}

async function sendExpoPush(messages) {
  if (typeof fetch !== 'function') {
    console.error('Global fetch unavailable; skipping push send');
    return;
  }
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      console.error('Expo push send failed:', err.message);
    }
  }
}

/**
 * Look up the recipient's stored push tokens and deliver a push. Never throws.
 *
 * @param {object} opts
 * @param {string} opts.recipientUsername - who receives the notification
 * @param {string} opts.actorUsername - who triggered it (used to skip self-notify)
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {object} [opts.data] - payload for tap-to-navigate handling
 */
async function sendInteractionNotification({
  recipientUsername,
  actorUsername,
  title,
  body,
  data = {},
}) {
  try {
    const recipient = normalizeUsername(recipientUsername);
    const actor = normalizeUsername(actorUsername);
    if (!recipient || !title || !body) return;
    if (recipient === actor) return;

    const db = getFirestore();
    const tokens = await getPushTokens(db, recipient);
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data: { ...data, recipient },
    }));
    await sendExpoPush(messages);
  } catch (err) {
    console.error('sendInteractionNotification failed:', err.message);
  }
}

module.exports = {
  PUSH_TOKENS_COLLECTION,
  isExpoPushToken,
  getPushTokens,
  storePushToken,
  removePushToken,
  resolveDisplayName,
  sendInteractionNotification,
};
