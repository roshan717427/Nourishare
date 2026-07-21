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
    const batch = db.batch(); //
    const oldTarget = "rosh";
    const myTrueNewUsername = "ocean_roshan7";
    let count = 0;

    const targetCollections = ['ai_suggestions', 'ai_usage', 'meal_plans'];
    
    for (const colName of targetCollections) {
      const oldRef = db.collection(colName).doc(oldTarget);
      const oldDoc = await oldRef.get();
      
      const newRef = db.collection(colName).doc(myTrueNewUsername);
      const newDoc = await newRef.get();

      if (oldDoc.exists) {
        const oldData = oldDoc.data() || {};
        const newData = newDoc.exists ? (newDoc.data() || {}) : {};

        // Merge top level keys
        const mergedData = { ...oldData, ...newData };

        // Safe array merge and de-duplication
        const arrayKeysToMerge = ['preference_suggestions', 'friend_suggestions', 'pantry_suggestions', 'history', 'items', 'recipes'];
        arrayKeysToMerge.forEach((key) => {
          if (Array.isArray(oldData[key]) || Array.isArray(newData[key])) {
            const oldArray = Array.isArray(oldData[key]) ? oldData[key] : [];
            const newArray = Array.isArray(newData[key]) ? newData[key] : [];
            
            const uniqueMap = new Map();
            [...oldArray, ...newArray].forEach(item => {
              if (item && item.id) uniqueMap.set(item.id, item);
              else if (item) uniqueMap.set(JSON.stringify(item), item);
            });
            mergedData[key] = Array.from(uniqueMap.values());
          }
        });

        if (typeof oldData.total_cached === 'number' || typeof newData.total_cached === 'number') {
          mergedData.total_cached = Math.max(oldData.total_cached || 0, newData.total_cached || 0);
        }

        batch.set(newRef, mergedData, { merge: true });
        batch.delete(oldRef); // Delete old 'rosh' document
        count++;
      }
    }

    await batch.commit(); //
    return res.status(200).json({ status: 'success', totalMergedDocuments: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
