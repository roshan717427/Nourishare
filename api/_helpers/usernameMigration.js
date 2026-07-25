/**
 * Username-change cascade helpers for likes, comments, and tags.
 *
 * Firestore keys likes by username:
 *   post_likes/{postId}/users/{username}
 *   comment_likes/{commentId}/users/{username}
 * so a rename must move those docs or the old handle remains as a "ghost" like.
 *
 * Default path uses filtered collectionGroup queries + path-specific reads.
 * Never runs unfiltered collectionGroup().get() scans.
 * O(all-posts) enumeration is opt-in via MIGRATE_ENUMERATE_ALL_POSTS=1.
 */

const BATCH_LIMIT = 400;
const POST_COLLECTIONS = ['logs', 'recipe_posts'];
const GET_CONCURRENCY = 40;

/** Set to '1' to also probe every known post/comment for legacy like docs. */
function allowEnumerateAllPosts() {
  return String(process.env.MIGRATE_ENUMERATE_ALL_POSTS || '') === '1';
}

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

async function listAllPostIds(db) {
  const ids = new Set();
  for (const col of POST_COLLECTIONS) {
    const refs = await db.collection(col).listDocuments();
    refs.forEach((ref) => ids.add(ref.id));
  }
  return [...ids];
}

async function mapInChunks(items, concurrency, mapper) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(mapper));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Move a like doc oldRef -> newRef.
 * If newRef already exists (duplicate under both handles), delete the old ghost
 * only and flag the parent for a likes_count recount.
 */
function queueLikeMove(ops, seenPaths, oldRef, newRef, data, now, oldName, newExists, onDuplicate) {
  const key = oldRef.path;
  if (seenPaths.has(key)) return;
  seenPaths.add(key);

  if (newExists) {
    ops.push((batch) => {
      batch.delete(oldRef);
    });
    if (typeof onDuplicate === 'function') onDuplicate();
    return;
  }

  const payload = {
    ...(data || {}),
    username: newRef.id,
    migratedAt: now,
    migratedFrom: oldName,
  };
  ops.push((batch) => {
    batch.set(newRef, payload, { merge: true });
    batch.delete(oldRef);
  });
}

async function recountPostLikes(db, postId) {
  const usersSnap = await db.collection('post_likes').doc(postId).collection('users').get();
  const count = usersSnap.size;
  for (const col of POST_COLLECTIONS) {
    const postRef = db.collection(col).doc(postId);
    const postDoc = await postRef.get();
    if (postDoc.exists) {
      await postRef.set({ likes_count: count }, { merge: true });
      return;
    }
  }
}

async function recountCommentLikes(db, postId, commentId) {
  if (!postId || !commentId) return;
  const usersSnap = await db.collection('comment_likes').doc(commentId).collection('users').get();
  const commentRef = db.collection('post_comments').doc(postId).collection('items').doc(commentId);
  const commentDoc = await commentRef.get();
  if (!commentDoc.exists) return;
  await commentRef.set({ likes_count: usersSnap.size }, { merge: true });
}

/**
 * Move post/comment likes, rewrite comment authors, and retarget cookedWith tags.
 * Prefer filtered queries; optional O(posts) probe behind MIGRATE_ENUMERATE_ALL_POSTS.
 * Throws on failure so callers (username rename) abort before deleting the old profile.
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
  const seenLikePaths = new Set();
  const now = new Date().toISOString();
  const recountPostIds = new Set();
  const recountCommentKeys = new Map(); // commentId -> postId
  const commentIds = [];
  const commentIdToPostId = new Map();
  const seenCommentAuthorPaths = new Set();

  const queueCommentAuthorMove = (doc) => {
    if (seenCommentAuthorPaths.has(doc.ref.path)) return;
    seenCommentAuthorPaths.add(doc.ref.path);
    ops.push((batch) => {
      batch.update(doc.ref, { username: newName });
    });
  };

  // 1) Likes that store a username field (current write path) — filtered only.
  try {
    const likedByFieldSnap = await db
      .collectionGroup('users')
      .where('username', '==', oldName)
      .get();
    await mapInChunks(likedByFieldSnap.docs, GET_CONCURRENCY, async (doc) => {
      const path = doc.ref.path;
      if (path.includes('post_likes/')) {
        const postId = path.split('/')[1];
        if (!postId) return;
        const newRef = db.collection('post_likes').doc(postId).collection('users').doc(newName);
        const newSnap = await newRef.get();
        queueLikeMove(
          ops,
          seenLikePaths,
          doc.ref,
          newRef,
          doc.data(),
          now,
          oldName,
          newSnap.exists,
          () => recountPostIds.add(postId)
        );
        return;
      }
      if (path.includes('comment_likes/')) {
        const commentId = path.split('/')[1];
        if (!commentId) return;
        const newRef = db
          .collection('comment_likes')
          .doc(commentId)
          .collection('users')
          .doc(newName);
        const newSnap = await newRef.get();
        queueLikeMove(
          ops,
          seenLikePaths,
          doc.ref,
          newRef,
          doc.data(),
          now,
          oldName,
          newSnap.exists,
          () => {
            if (!recountCommentKeys.has(commentId)) {
              recountCommentKeys.set(commentId, null);
            }
          }
        );
      }
    });
  } catch (err) {
    // Index may not exist yet; optional enumeration below can cover doc-id likes.
    console.warn('username-field like query skipped:', err.message);
  }

  // 2) Comment authors via filtered collectionGroup (no full items scan).
  try {
    const commentsByAuthorSnap = await db
      .collectionGroup('items')
      .where('username', '==', oldName)
      .get();
    commentsByAuthorSnap.forEach((doc) => {
      if (!doc.ref.path.includes('post_comments/')) return;
      const parts = doc.ref.path.split('/');
      // post_comments/{postId}/items/{commentId}
      const postId = parts[1];
      if (postId) commentIdToPostId.set(doc.id, postId);
      queueCommentAuthorMove(doc);
      if (!commentIds.includes(doc.id)) commentIds.push(doc.id);
    });
  } catch (err) {
    console.warn('comment author query skipped:', err.message);
  }

  // 3) Optional O(all-posts) probe for legacy likes/comments missing username fields.
  //    Gated — listing every post and reading like/comment trees can burn huge read quotas.
  if (allowEnumerateAllPosts()) {
    const postIds = await listAllPostIds(db);

    await mapInChunks(postIds, GET_CONCURRENCY, async (postId) => {
      const oldRef = db.collection('post_likes').doc(postId).collection('users').doc(oldName);
      const newRef = db.collection('post_likes').doc(postId).collection('users').doc(newName);
      const [oldSnap, newSnap] = await Promise.all([oldRef.get(), newRef.get()]);
      if (!oldSnap.exists) return;
      queueLikeMove(
        ops,
        seenLikePaths,
        oldRef,
        newRef,
        oldSnap.data(),
        now,
        oldName,
        newSnap.exists,
        () => recountPostIds.add(postId)
      );
    });

    await mapInChunks(postIds, GET_CONCURRENCY, async (postId) => {
      const itemsSnap = await db.collection('post_comments').doc(postId).collection('items').get();
      itemsSnap.forEach((doc) => {
        commentIds.push(doc.id);
        commentIdToPostId.set(doc.id, postId);
        const author = String(doc.data()?.username || '')
          .trim()
          .toLowerCase();
        if (author !== oldName) return;
        queueCommentAuthorMove(doc);
      });
    });
  } else {
    console.warn(
      'migrateEngagement: skipping O(posts) like/comment enumeration; ' +
        'set MIGRATE_ENUMERATE_ALL_POSTS=1 to probe legacy docs without username fields'
    );
  }

  // 4) Comment likes keyed by doc id (no username field): only when we enumerated
  //    every comment under known posts. Otherwise filtered collectionGroup above
  //    already covers current writes that store username.
  if (allowEnumerateAllPosts() && commentIds.length > 0) {
    const uniqueCommentIds = [...new Set(commentIds)];
    await mapInChunks(uniqueCommentIds, GET_CONCURRENCY, async (commentId) => {
      const oldRef = db.collection('comment_likes').doc(commentId).collection('users').doc(oldName);
      if (seenLikePaths.has(oldRef.path)) return;
      const newRef = db.collection('comment_likes').doc(commentId).collection('users').doc(newName);
      const [oldSnap, newSnap] = await Promise.all([oldRef.get(), newRef.get()]);
      if (!oldSnap.exists) return;
      const postId = commentIdToPostId.get(commentId) || null;
      queueLikeMove(
        ops,
        seenLikePaths,
        oldRef,
        newRef,
        oldSnap.data(),
        now,
        oldName,
        newSnap.exists,
        () => recountCommentKeys.set(commentId, postId)
      );
    });
  }

  // Fill postIds for any comment-like duplicates found only via username field query.
  for (const [commentId, postId] of recountCommentKeys) {
    if (!postId && commentIdToPostId.has(commentId)) {
      recountCommentKeys.set(commentId, commentIdToPostId.get(commentId));
    }
  }

  // 5) "Cooked with" tags on meal logs — filtered query only.
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

  // After deletes land, recount denormalized counters for any duplicate ghost likes removed.
  for (const postId of recountPostIds) {
    await recountPostLikes(db, postId);
  }
  for (const [commentId, postId] of recountCommentKeys) {
    await recountCommentLikes(db, postId, commentId);
  }

  return { migrated: ops.length };
}

module.exports = {
  migrateEngagementForUsername,
  uniqueUsernames,
  listAllPostIds,
};
