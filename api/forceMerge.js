const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}
db = getFirestore();

module.exports = async (req, res) => {
  try {
    const batch = db.batch();
    const oldTarget = "rosh";
    const myTrueNewUsername = "ocean_roshan7"; 
    let migratedSubDocsCount = 0;

    // 🛠️ EXACT BLUEPRINT MAPPING DISPATCHER
    const migrations = [
      { collection: 'ai_suggestions', subCollection: 'recipes' },
      { collection: 'ai_usage',       subCollection: 'daily' },
      { collection: 'meal_plans',     subCollection: 'entries' }
    ];

    for (const track of migrations) {
      const oldParentRef = db.collection(track.collection).doc(oldTarget);
      
      // Target the explicit sub-collection path using your mapped structural name keys
      const subDocsSnapshot = await oldParentRef.collection(track.subCollection).get();
      
      subDocsSnapshot.forEach((doc) => {
        if (doc.exists) {
          // Re-serialize the exact document item data under your true active handle path tree
          const newSubDocRef = db.collection(track.collection)
            .doc(myTrueNewUsername)
            .collection(track.subCollection)
            .doc(doc.id);
            
          batch.set(newSubDocRef, doc.data() || {});
          batch.delete(doc.ref); // Safely clear out the legacy record node
          migratedSubDocsCount++;
        }
      });

      // Migrate any lingering root document properties (like total counts) if present
      const oldParentDoc = await oldParentRef.get();
      if (oldParentDoc.exists) {
        const newParentRef = db.collection(track.collection).doc(myTrueNewUsername);
        batch.set(newParentRef, oldParentDoc.data() || {}, { merge: true });
        batch.delete(oldParentRef);
      }
    }

    // Execute the unified full-stack atomic cloud sweep
    await batch.commit();
    return res.status(200).json({ 
      status: 'success', 
      message: `Successfully migrated all named recipe, daily usage, and calendar entry sub-collections over to '${myTrueNewUsername}'!`,
      totalNestedDocumentsMoved: migratedSubDocsCount 
    });
  } catch (err) {
    console.error('Explicit sub-collection blueprint migration pass failed:', err);
    return res.status(500).json({ error: err.message });
  }
};
