/**
 * Block-list helpers for social graph filtering.
 */

function normalizeBlockedList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    const name = String(raw || '')
      .trim()
      .toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

async function getBlockedUsersFor(db, username) {
  if (!username) return [];
  try {
    const doc = await db.collection('users').doc(username).get();
    if (!doc.exists) return [];
    return normalizeBlockedList(doc.data()?.blockedUsers);
  } catch (err) {
    console.error('getBlockedUsersFor failed:', err.message);
    return [];
  }
}

/** True if either user has blocked the other. */
async function isEitherBlocked(db, a, b) {
  const userA = String(a || '')
    .trim()
    .toLowerCase();
  const userB = String(b || '')
    .trim()
    .toLowerCase();
  if (!userA || !userB || userA === userB) return false;
  const [aBlocks, bBlocks] = await Promise.all([
    getBlockedUsersFor(db, userA),
    getBlockedUsersFor(db, userB),
  ]);
  return aBlocks.includes(userB) || bBlocks.includes(userA);
}

function filterByBlocked(items, getUsername, blockedSet) {
  if (!blockedSet || blockedSet.size === 0) return items;
  return items.filter((item) => {
    const name = String(getUsername(item) || '')
      .trim()
      .toLowerCase();
    return !name || !blockedSet.has(name);
  });
}

module.exports = {
  normalizeBlockedList,
  getBlockedUsersFor,
  isEitherBlocked,
  filterByBlocked,
};
