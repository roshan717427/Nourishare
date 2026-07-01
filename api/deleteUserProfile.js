const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { normalizeUsername } = require('./_helpers/validateInput');

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

// Best-effort removal of the deleted user's own data and the dangling
// references other users hold to them. Each step is isolated so a single
// failure never blocks account deletion. Mirrors the best-effort cleanup
// pattern used elsewhere (e.g. comment-like cleanup in social.js).
async function cleanupDeletedUserData(username) {
  // The user's push notification tokens.
  await bestEffort('push_tokens', async () => {
    await db.collection('push_tokens').doc(username).delete();
  });

  // The user's own posts/logs.
  await bestEffort('logs', async () => {
    const snap = await db.collection('logs').where('username', '==', username).get();
    await commitDeletes(snap.docs.map((d) => d.ref));
  });
  await bestEffort('recipe_posts', async () => {
    const snap = await db.collection('recipe_posts').where('username', '==', username).get();
    await commitDeletes(snap.docs.map((d) => d.ref));
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

  // Pending follow requests (incoming + outgoing) and notifications.
  await bestEffort('follow_requests_incoming', async () => {
    const snap = await db
      .collection('follow_requests')
      .doc(username)
      .collection('requests')
      .get();
    await commitDeletes(snap.docs.map((d) => d.ref));
  });
  await bestEffort('follow_requests_outgoing', async () => {
    const snap = await db
      .collection('follow_requests_outgoing')
      .doc(username)
      .collection('pending')
      .get();
    await commitDeletes(snap.docs.map((d) => d.ref));
  });
  await bestEffort('notifications', async () => {
    const snap = await db
      .collection('notifications')
      .doc(username)
      .collection('items')
      .get();
    await commitDeletes(snap.docs.map((d) => d.ref));
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
    await cleanupDeletedUserData(auth.username);

    res.status(200).json({ message: 'User profile deleted' });
  } catch (error) {
    console.error('Error deleting user profile:', error);
    res.status(500).json({
      error: 'Failed to delete user profile',
      ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
    });
  }
};
