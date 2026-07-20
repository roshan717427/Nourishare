const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;
try {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  db = getFirestore();
} catch (error) {
  console.error(error);
}

module.exports = async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB not ready' });

  try {
    // 1. Fetch top-level list of collections present in your cloud instance
    const collections = await db.listCollections();
    const collectionIds = collections.map(c => c.id);

    // 2. Perform a probe check on 'cook_next' specifically
    const cookNextSample = await db.collection('cook_next').limit(3).get();
    const hasDocuments = !cookNextSample.empty;
    
    let sampleDocStructure = "No documents found";
    if (hasDocuments) {
      sampleDocStructure = cookNextSample.docs.map(d => ({
        documentId: d.id,
        path: d.ref.path,
        fields: Object.keys(d.data() || {})
      }));
    }

    return res.status(200).json({
      existsInDatabase: collectionIds.includes('cook_next'),
      allActiveCollections: collectionIds,
      cookNextProbeResult: {
        hasDocuments,
        sampleDataStructure: sampleDocStructure
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
