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
    const myTrueNewUsername = "ocean_roshan7"; // Spelled exactly to match your database console folder!
    let count = 0;

    const targetCollections = ['ai_suggestions', 'ai_usage', 'meal_plans'];
    
    for (const colName of targetCollections) {
      const oldRef = db.collection(colName).doc(oldTarget);
      const oldDoc = await oldRef.get();
      
      const newRef = db.collection(colName).doc(myTrueNewUsername);
      const newDoc = await newRef.get();

      // 🛠️ FIX: Read payloads fallback-ready without requiring .exists to be true!
      const oldData = oldDoc.exists ? (oldDoc.data() || {}) : {};
      const newData = newDoc.exists ? (newDoc.data() || {}) : {};

      // Blend top level attributes cleanly
      const mergedData = { ...oldData, ...newData };

      // Safe array extraction and de-duplication
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

      // Force write to the new document and clean up the legacy folder anchor point
      batch.set(newRef, mergedData);
      batch.delete(oldRef);
      count++;
    }

    await batch.commit();
    return res.status(200).json({ status: 'success', totalMergedDocuments: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};