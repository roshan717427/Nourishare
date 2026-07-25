const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { normalizeUsername } = require('./_helpers/validateInput');
const { listAllPostIds } = require('./_helpers/usernameMigration');

const DELETED_USERNAME = 'deleted_user';
const DELETED_DISPLAY_NAME = 'Deleted User';
const GET_CONCURRENCY = 40;
const POST_COLLECTIONS = ['logs', 'recipe_posts'];

let db;
let adminAuth;
try {
  if (!getApps().length) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set');
    }
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  db = getFirestore();
  adminAuth = getAuth();
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// Firestore batches allow up to 500 writes; stay safely under that.
const DELETE_BATCH_SIZE = 400;

// Commit deletes for an arbitrary list of doc refs in chunked batches.
async function commitDeletes(refs) {
  for (let i = 0; i < refs.length; i += DELETE_BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + DELETE_BATCH_SIZE)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

// Run a cleanup step without letting its failure abort account deletion.
async function bestEffort(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`deleteUserProfile cleanup (${label}) failed:`, err.message);
  }
}

async function recountPostLikes(postId) {
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

async function recountCommentLikes(postId, commentId) {
  if (!postId || !commentId) return;
  const usersSnap = await db.collection('comment_likes').doc(commentId).collection('users').get();
  const commentRef = db.collection('post_comments').doc(postId).collection('items').doc(commentId);
  const commentDoc = await commentRef.get();
  if (!commentDoc.exists) return;
  await commentRef.set({ likes_count: usersSnap.size }, { merge: true });
}

async function commitUpdates(updates) {
  for (let i = 0; i < updates.length; i += DELETE_BATCH_SIZE) {
    const batch = db.batch();
    updates.slice(i, i + DELETE_BATCH_SIZE).forEach(({ ref, data }) => {
      batch.update(ref, data);
    });
    await batch.commit();
  }
}

/** Delete all docs matching a query, in chunks (avoids leaving leftovers past one page). */
async function deleteMatchingDocs(buildQuery) {
  for (;;) {
    const snap = await buildQuery().limit(DELETE_BATCH_SIZE).get();
    if (snap.empty) break;
    await commitDeletes(snap.docs.map((d) => d.ref));
    if (snap.size < DELETE_BATCH_SIZE) break;
  }
}

/** Delete comments, comment likes, and post likes for a post (avoids orphaned trees). */
async function deletePostSocialTree(postId) {
  const refs = [];

  const commentsSnap = await db
    .collection('post_comments')
    .doc(postId)
    .collection('items')
    .get();
  for (const commentDoc of commentsSnap.docs) {
    refs.push(commentDoc.ref);
    const commentLikesSnap = await db
      .collection('comment_likes')
      .doc(commentDoc.id)
      .collection('users')
      .get();
    commentLikesSnap.docs.forEach((d) => refs.push(d.ref));
    refs.push(db.collection('comment_likes').doc(commentDoc.id));
  }
  refs.push(db.collection('post_comments').doc(postId));

  const postLikesSnap = await db
    .collection('post_likes')
    .doc(postId)
    .collection('users')
    .get();
  postLikesSnap.docs.forEach((d) => refs.push(d.ref));
  refs.push(db.collection('post_likes').doc(postId));

  await commitDeletes(refs);
}

// Best-effort removal of the deleted user's own data and the dangling
// references other users hold to them. Each step is isolated so a single
// failure never blocks account deletion. Mirrors the best-effort cleanup
// pattern used elsewhere (e.g. comment-like cleanup in social.js).
// Comments on others' posts are anonymized (not deleted). Likes are removed
// and counts recounted. The deleted user's own posts cascade-delete their
// comment/like trees.
async function cleanupDeletedUserData(username, { uid = null, email = null } = {}) {
  // The user's push notification tokens.
  await bestEffort('push_tokens', async () => {
    await db.collection('push_tokens').doc(username).delete();
  });

  // The user's own posts/logs + their social trees (comments, likes).
  await bestEffort('owned_posts_and_trees', async () => {
    const postIds = new Set();
    for (const col of POST_COLLECTIONS) {
      const snap = await db.collection(col).where('username', '==', username).get();
      snap.docs.forEach((d) => postIds.add(d.id));
      await commitDeletes(snap.docs.map((d) => d.ref));
    }
    for (const postId of postIds) {
      try {
        await deletePostSocialTree(postId);
      } catch (err) {
        console.warn('delete post social tree failed:', postId, err.message);
      }
    }
  });

  // Recipes/entries filed under the username itself. If left behind, a new
  // account created with the same (now-freed) username would inherit the
  // deleted account's meal plan and AI-suggested recipes.
  await bestEffort('meal_plans', async () => {
    const snap = await db.collection('meal_plans').doc(username).collection('entries').get();
    await commitDeletes(snap.docs.map((d) => d.ref));
    await db.collection('meal_plans').doc(username).delete();
  });
  await bestEffort('ai_suggestions', async () => {
    const snap = await db.collection('ai_suggestions').doc(username).collection('recipes').get();
    await commitDeletes(snap.docs.map((d) => d.ref));
    await db.collection('ai_suggestions').doc(username).delete();
  });
  await bestEffort('ai_usage', async () => {
    const snap = await db.collection('ai_usage').doc(username).collection('daily').get();
    await commitDeletes(snap.docs.map((d) => d.ref));
    await db.collection('ai_usage').doc(username).delete();
  });

  // Outgoing follow edges + the mirror on each target user's followers list.
  await bestEffort('outgoing_follows', async () => {
    const snap = await db
      .collection('following')
      .doc(username)
      .collection('user_following')
      .get();
    const refs = [];
    for (const doc of snap.docs) {
      const targetUsername = doc.id;
      refs.push(doc.ref);
      refs.push(
        db
          .collection('followers')
          .doc(targetUsername)
          .collection('user_followers')
          .doc(username)
      );
    }
    await commitDeletes(refs);
  });

  // Inbound follow edges + the mirror on each follower's following list.
  await bestEffort('inbound_follows', async () => {
    const snap = await db
      .collection('followers')
      .doc(username)
      .collection('user_followers')
      .get();
    const refs = [];
    for (const doc of snap.docs) {
      const followerUsername = doc.id;
      refs.push(doc.ref);
      refs.push(
        db
          .collection('following')
          .doc(followerUsername)
          .collection('user_following')
          .doc(username)
      );
    }
    await commitDeletes(refs);
  });

  // Pending follow requests: own trees + peer mirrors so others don't keep
  // ghost requests/notifications from a deleted account.
  await bestEffort('follow_requests_incoming', async () => {
    const snap = await db
      .collection('follow_requests')
      .doc(username)
      .collection('requests')
      .get();
    const refs = [];
    for (const doc of snap.docs) {
      const fromUsername = doc.id;
      refs.push(doc.ref);
      refs.push(
        db
          .collection('follow_requests_outgoing')
          .doc(fromUsername)
          .collection('pending')
          .doc(username)
      );
    }
    await commitDeletes(refs);
  });
  await bestEffort('follow_requests_outgoing', async () => {
    const snap = await db
      .collection('follow_requests_outgoing')
      .doc(username)
      .collection('pending')
      .get();
    const refs = [];
    for (const doc of snap.docs) {
      const targetUsername = doc.id;
      refs.push(doc.ref);
      refs.push(
        db
          .collection('follow_requests')
          .doc(targetUsername)
          .collection('requests')
          .doc(username)
      );
      refs.push(
        db
          .collection('notifications')
          .doc(targetUsername)
          .collection('items')
          .doc(username)
      );
    }
    await commitDeletes(refs);
  });
  await bestEffort('notifications', async () => {
    const snap = await db
      .collection('notifications')
      .doc(username)
      .collection('items')
      .get();
    await commitDeletes(snap.docs.map((d) => d.ref));
  });
  // Any leftover notifs keyed by this sender on other users' inboxes.
  await bestEffort('peer_notifications', async () => {
    try {
      const snap = await db
        .collectionGroup('items')
        .where('fromUsername', '==', username)
        .get();
      const refs = snap.docs
        .filter((d) => d.ref.path.includes('notifications/'))
        .map((d) => d.ref);
      await commitDeletes(refs);
    } catch (err) {
      console.warn('peer notifications collectionGroup skipped:', err.message);
    }
  });

  // Anonymize comments (keep threads intact; free the real display name/username
  // so another account can reuse the deleted user's first/last name).
  await bestEffort('anonymize_comments', async () => {
    const seenPaths = new Set();
    const updates = [];
    const anonymizePayload = {
      username: DELETED_USERNAME,
      name: DELETED_DISPLAY_NAME,
      deletedAccountAt: new Date().toISOString(),
    };

    const queueAnonymize = (doc) => {
      if (!doc?.ref?.path?.includes('post_comments/') || seenPaths.has(doc.ref.path)) return;
      seenPaths.add(doc.ref.path);
      updates.push({ ref: doc.ref, data: anonymizePayload });
    };

    const postIds = await listAllPostIds(db);
    for (let i = 0; i < postIds.length; i += GET_CONCURRENCY) {
      const chunk = postIds.slice(i, i + GET_CONCURRENCY);
      await Promise.all(
        chunk.map(async (postId) => {
          const itemsSnap = await db
            .collection('post_comments')
            .doc(postId)
            .collection('items')
            .get();
          itemsSnap.forEach((doc) => {
            const author = String(doc.data()?.username || '')
              .trim()
              .toLowerCase();
            if (author === username) queueAnonymize(doc);
          });
        })
      );
    }

    // Fallback for comments on posts no longer in logs/recipe_posts.
    try {
      const snap = await db.collectionGroup('items').where('username', '==', username).get();
      snap.docs.forEach(queueAnonymize);
    } catch (err) {
      console.warn('anonymize comments collectionGroup skipped:', err.message);
    }

    await commitUpdates(updates);
  });

  // Remove this user's likes (post + comment) and recount denormalized counts.
  // Likes are keyed by username; also match docs that store uid/email fields.
  await bestEffort('delete_likes', async () => {
    const deletedLikePaths = new Set();
    const recountPosts = new Set();
    const recountComments = new Map(); // commentId -> postId|null
    const commentIdToPostId = new Map();

    const queueDelete = (docRef, kind, postId, commentId) => {
      if (!docRef) return;
      if (deletedLikePaths.has(docRef.path)) {
        if (kind === 'post' && postId) recountPosts.add(postId);
        if (kind === 'comment' && commentId) {
          recountComments.set(
            commentId,
            postId || commentIdToPostId.get(commentId) || recountComments.get(commentId) || null
          );
        }
        return;
      }
      deletedLikePaths.add(docRef.path);
      if (kind === 'post' && postId) recountPosts.add(postId);
      if (kind === 'comment' && commentId) {
        const resolvedPostId =
          postId || commentIdToPostId.get(commentId) || recountComments.get(commentId) || null;
        if (postId) commentIdToPostId.set(commentId, postId);
        recountComments.set(commentId, resolvedPostId);
      }
    };

    const ingestLikeDoc = (doc) => {
      const path = doc.ref.path;
      if (path.includes('post_likes/')) {
        queueDelete(doc.ref, 'post', path.split('/')[1], null);
      } else if (path.includes('comment_likes/')) {
        queueDelete(doc.ref, 'comment', null, path.split('/')[1]);
      }
    };

    const fieldQueries = [{ field: 'username', value: username }];
    if (uid) fieldQueries.push({ field: 'uid', value: uid });
    if (email) {
      const emailRaw = String(email).trim();
      fieldQueries.push({ field: 'email', value: emailRaw });
      const emailLower = emailRaw.toLowerCase();
      if (emailLower !== emailRaw) {
        fieldQueries.push({ field: 'email', value: emailLower });
      }
    }

    for (const { field, value } of fieldQueries) {
      try {
        const byField = await db.collectionGroup('users').where(field, '==', value).get();
        byField.forEach(ingestLikeDoc);
      } catch (err) {
        console.warn(`delete likes by ${field} skipped:`, err.message);
      }
    }

    const postIds = await listAllPostIds(db);
    for (let i = 0; i < postIds.length; i += GET_CONCURRENCY) {
      const chunk = postIds.slice(i, i + GET_CONCURRENCY);
      await Promise.all(
        chunk.map(async (postId) => {
          const likeRef = db.collection('post_likes').doc(postId).collection('users').doc(username);
          const likeSnap = await likeRef.get();
          if (likeSnap.exists) queueDelete(likeRef, 'post', postId, null);

          const commentsSnap = await db
            .collection('post_comments')
            .doc(postId)
            .collection('items')
            .get();
          await Promise.all(
            commentsSnap.docs.map(async (commentDoc) => {
              const commentId = commentDoc.id;
              commentIdToPostId.set(commentId, postId);
              const cLikeRef = db
                .collection('comment_likes')
                .doc(commentId)
                .collection('users')
                .doc(username);
              const cLikeSnap = await cLikeRef.get();
              if (cLikeSnap.exists) queueDelete(cLikeRef, 'comment', postId, commentId);
            })
          );
        })
      );
    }

    // Resolve any comment likes found only via field query.
    for (const [commentId, postId] of recountComments) {
      if (!postId && commentIdToPostId.has(commentId)) {
        recountComments.set(commentId, commentIdToPostId.get(commentId));
      }
    }

    const likeRefs = [...deletedLikePaths].map((path) => db.doc(path));
    await commitDeletes(likeRefs);

    for (const postId of recountPosts) {
      try {
        await recountPostLikes(postId);
      } catch (err) {
        console.warn('recount post likes failed:', postId, err.message);
      }
    }

    for (const [commentId, postId] of recountComments) {
      try {
        await recountCommentLikes(postId || commentIdToPostId.get(commentId), commentId);
      } catch (err) {
        console.warn('recount comment likes failed:', commentId, err.message);
      }
    }
  });

  // Clear this username from other users' blockedUsers lists (blocks are stored
  // as arrays on user docs — the deleted user's own list goes away with their
  // profile doc). Loop until no matches remain.
  await bestEffort('blocked_by_others', async () => {
    for (;;) {
      const snap = await db
        .collection('users')
        .where('blockedUsers', 'array-contains', username)
        .limit(100)
        .get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        const next = (doc.data()?.blockedUsers || []).filter(
          (u) => String(u).toLowerCase() !== username
        );
        await doc.ref.set({ blockedUsers: next }, { merge: true });
      }
      if (snap.size < 100) break;
    }
  });

  // Delete report docs where this user was the reporter or the target.
  await bestEffort('reports', async () => {
    await deleteMatchingDocs(() =>
      db.collection('reports').where('reporterUsername', '==', username)
    );
    await deleteMatchingDocs(() =>
      db.collection('reports').where('targetUsername', '==', username)
    );
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!db || !adminAuth) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const { username } = req.body;
  const auth = await requireAuthForUsername(req, res, username);
  if (!auth) return;

  try {
    const userRef = db.collection('users').doc(auth.username);
    const userDoc = await userRef.get();
    const profileEmail = userDoc.exists ? userDoc.data()?.email : null;

    await userRef.delete();

    let authUid = auth.uid;
    if (!authUid && profileEmail) {
      try {
        const authUser = await adminAuth.getUserByEmail(profileEmail);
        authUid = authUser.uid;
      } catch (lookupError) {
        if (lookupError.code !== 'auth/user-not-found') {
          throw lookupError;
        }
      }
    }

    if (authUid) {
      try {
        await adminAuth.deleteUser(authUid);
      } catch (deleteError) {
        if (deleteError.code !== 'auth/user-not-found') {
          throw deleteError;
        }
      }
    }

    // Best-effort hygiene cleanup of the user's remaining data and the dangling
    // references others hold to them. This never throws, so a cleanup failure
    // cannot block the (already completed) account deletion.
    await cleanupDeletedUserData(auth.username, {
      uid: authUid || auth.uid || null,
      email: profileEmail || auth.email || null,
    });

    res.status(200).json({ message: 'User profile deleted' });
  } catch (error) {
    console.error('Error deleting user profile:', error);
    res.status(500).json({
      error: 'Failed to delete user profile',
      ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
    });
  }
};
