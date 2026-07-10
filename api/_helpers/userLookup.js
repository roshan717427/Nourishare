const { normalizeUsername } = require('./validateInput');

async function partitionExistingUsernames(db, rawUsernames) {
  const usernames = [];
  const seen = new Set();
  for (const entry of rawUsernames || []) {
    const username = normalizeUsername(entry);
    if (username && !seen.has(username)) {
      seen.add(username);
      usernames.push(username);
    }
  }

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

module.exports = { partitionExistingUsernames };