/**
 * Username-change cascade helpers for likes, comments, and tags.
 *
 * Firestore keys likes by username:
 *   post_likes/{postId}/users/{username}
 *   comment_likes/{commentId}/users/{username}
 * so a rename must move those docs or the old handle remains as a "ghost" like.
 */

const BATCH_LIMIT = 400;

async function commitOps(db, ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((apply) => apply(batch));
    await batch.commit();
  }
}

function uniqueUsernames(values) {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const value = String(raw || '')
      .trim()
      .toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Move post/comment likes, rewrite comment authors, and retarget cookedWith tags.
 */
async function migrateEngagementForUsername(db, oldUsername, newUsername) {
  const oldName = String(oldUsername || '')
    .trim()
    .toLowerCase();
  const newName = String(newUsername || '')
    .trim()
    .toLowerCase();
  if (!oldName || !newName || oldName === newName) return { migrated: 0 };

  const ops = [];
  const now = new Date().toISOString();

  // 1) Likes keyed by username doc id under post_likes / comment_likes
  const likeUsersSnap = await db.collectionGroup('users').get();
  likeUsersSnap.forEach((doc) => {
    if (doc.id.toLowerCase() !== oldName) return;
    const path = doc.ref.path;
    const data = { ...(doc.data() || {}), migratedAt: now, migratedFrom: oldName };

    if (path.includes('post_likes/')) {
      const parts = path.split('/');
      const postId = parts[1];
      if (!postId) return;
      const newRef = db.collection('post_likes').doc(postId).collection('users').doc(newName);
      ops.push((batch) => {
        batch.set(newRef, data, { merge: true });
        batch.delete(doc.ref);
      });
      return;
    }

    if (path.includes('comment_likes/')) {
      const parts = path.split('/');
      const commentId = parts[1];
      if (!commentId) return;
      const newRef = db
        .collection('comment_likes')
        .doc(commentId)
        .collection('users')
        .doc(newName);
      ops.push((batch) => {
        batch.set(newRef, data, { merge: true });
        batch.delete(doc.ref);
      });
    }
  });

  // 2) Comment author field on post_comments/{postId}/items/{id}
  const commentItemsSnap = await db.collectionGroup('items').get();
  commentItemsSnap.forEach((doc) => {
    if (!doc.ref.path.includes('post_comments/')) return;
    const data = doc.data() || {};
    const author = String(data.username || '')
      .trim()
      .toLowerCase();
    if (author !== oldName) return;
    ops.push((batch) => {
      batch.update(doc.ref, { username: newName });
    });
  });

  // 3) "Cooked with" tags on meal logs
  const taggedLogsSnap = await db
    .collection('logs')
    .where('cookedWith', 'array-contains', oldName)
    .get();
  taggedLogsSnap.forEach((doc) => {
    const data = doc.data() || {};
    const nextTags = uniqueUsernames([
      ...(Array.isArray(data.cookedWith) ? data.cookedWith : []),
      newName,
    ]).filter((tag) => tag !== oldName);
    ops.push((batch) => {
      batch.update(doc.ref, { cookedWith: nextTags });
    });
  });

  await commitOps(db, ops);
  return { migrated: ops.length };
}

/**
 * Heal likes on a single post for a viewer who renamed accounts.
 * Moves likes from previousUsernames (and email/uid matches) onto the current handle.
 */
async function healViewerLikesOnPost(db, postId, auth, previousUsernames = []) {
  if (!postId || !auth?.username) return { healed: 0 };

  const currentUsername = String(auth.username).trim().toLowerCase();
  const email = String(auth.email || '')
    .trim()
    .toLowerCase();
  const uid = auth.uid || null;
  const aliases = uniqueUsernames(previousUsernames).filter((name) => name !== currentUsername);

  const likesSnap = await db.collection('post_likes').doc(postId).collection('users').get();
  if (likesSnap.empty) return { healed: 0 };

  const currentRef = db.collection('post_likes').doc(postId).collection('users').doc(currentUsername);
  const currentDoc = likesSnap.docs.find((doc) => doc.id.toLowerCase() === currentUsername);
  const ops = [];
  let healed = 0;

  for (const doc of likesSnap.docs) {
    const likeUsername = doc.id.toLowerCase();
    if (likeUsername === currentUsername) continue;

    const data = doc.data() || {};
    const emailMatch = email && String(data.email || '').trim().toLowerCase() === email;
    const uidMatch = uid && data.uid && String(data.uid) === String(uid);
    const aliasMatch = aliases.includes(likeUsername);

    if (!emailMatch && !uidMatch && !aliasMatch) continue;

    const payload = {
      ...data,
      email: email || data.email || null,
      uid: uid || data.uid || null,
      migratedAt: new Date().toISOString(),
      migratedFrom: likeUsername,
    };

    if (!currentDoc) {
      ops.push((batch) => {
        batch.set(currentRef, payload, { merge: true });
        batch.delete(doc.ref);
      });
    } else {
      // Already liked under the new handle — drop the ghost without changing count.
      ops.push((batch) => {
        batch.delete(doc.ref);
      });
    }
    healed += 1;
  }

  if (ops.length) await commitOps(db, ops);
  return { healed };
}

module.exports = {
  migrateEngagementForUsername,
  healViewerLikesOnPost,
  uniqueUsernames,
};
