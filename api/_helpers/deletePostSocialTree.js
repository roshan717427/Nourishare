// Firestore batches allow up to 500 writes; stay safely under that.
const DELETE_BATCH_SIZE = 400;

/** Commit deletes for an arbitrary list of doc refs in chunked batches. */
async function commitDeletes(db, refs) {
  for (let i = 0; i < refs.length; i += DELETE_BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + DELETE_BATCH_SIZE)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

/**
 * Delete comments, comment likes, and post likes for a post (avoids orphaned trees).
 * Covers: post_comments/{postId}/items/*, comment_likes/{commentId}/users/* + parent,
 * and post_likes/{postId}/users/* + parent.
 */
async function deletePostSocialTree(db, postId) {
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

  await commitDeletes(db, refs);
}

module.exports = { commitDeletes, deletePostSocialTree, DELETE_BATCH_SIZE };
