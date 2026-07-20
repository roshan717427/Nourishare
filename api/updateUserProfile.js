const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAuthForUsername } = require('./_helpers/verifyAuth');
const { pickProfileUpdates } = require('./_helpers/validateInput');
const { capitalizeList } = require('../utils/titleCase');

let db;
try {
  if (!getApps().length) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set');
    }
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  db = getFirestore();
} catch (error) {
  console.error('Firebase initialization error:', error);
}
/**
 * Cascade-migrates a user handle across ALL top-level Firestore collections seamlessly,
 * ensuring zero broken data links when an account updates their handle string key.
 */
async function cascadeUsernameSocialMigration(db, oldUsername, newUsername, migratedProfileData) {
  const batch = db.batch();
  const now = new Date().toISOString();

  console.log(`>>> Starting optimized global database cascade: ${oldUsername} -> ${newUsername} <<<`);

  // 1. MIGRATE INBOUND FOLLOWERS & OUTBOUND FOLLOWING
  const followersSnapshot = await db.collection('followers').doc(oldUsername).collection('user_followers').get();
  followersSnapshot.forEach((doc) => {
    const newRef = db.collection('followers').doc(newUsername).collection('user_followers').doc(doc.id);
    batch.set(newRef, doc.data() || { timestamp: now });
    batch.delete(doc.ref);

    const peerFollowingRef = db.collection('following').doc(doc.id).collection('user_following').doc(oldUsername);
    const newPeerFollowingRef = db.collection('following').doc(doc.id).collection('user_following').doc(newUsername);
    batch.set(newPeerFollowingRef, { timestamp: now });
    batch.delete(peerFollowingRef);
  });
  batch.delete(db.collection('followers').doc(oldUsername));

  const followingSnapshot = await db.collection('following').doc(oldUsername).collection('user_following').get();
  followingSnapshot.forEach((doc) => {
    const newRef = db.collection('following').doc(newUsername).collection('user_following').doc(doc.id);
    batch.set(newRef, doc.data() || { timestamp: now });
    batch.delete(doc.ref);

    const peerFollowerRef = db.collection('followers').doc(doc.id).collection('user_followers').doc(oldUsername);
    const newPeerFollowerRef = db.collection('followers').doc(doc.id).collection('user_followers').doc(newUsername);
    batch.set(newPeerFollowerRef, { timestamp: now });
    batch.delete(peerFollowerRef);
  });
  batch.delete(db.collection('following').doc(oldUsername));

  // 2. MIGRATE INCOMING & OUTBOUND FOLLOW REQUESTS
  const incomingReqs = await db.collection('follow_requests').doc(oldUsername).collection('requests').get();
  incomingReqs.forEach((doc) => {
    const newRef = db.collection('follow_requests').doc(newUsername).collection('requests').doc(doc.id);
    batch.set(newRef, doc.data() || { status: 'pending', createdAt: now });
    batch.delete(doc.ref);

    const peerOutgoingRef = db.collection('follow_requests_outgoing').doc(doc.id).collection('pending').doc(oldUsername);
    const newPeerOutgoingRef = db.collection('follow_requests_outgoing').doc(doc.id).collection('pending').doc(newUsername);
    batch.set(newPeerOutgoingRef, { createdAt: now });
    batch.delete(peerOutgoingRef);
  });
  batch.delete(db.collection('follow_requests').doc(oldUsername));

  // 3. MIGRATE RECIPE LOGS OWNERSHIP REFERENCES (Direct where query — super fast)
  const userLogsSnapshot = await db.collection('logs').where('username', '==', oldUsername).get();
  userLogsSnapshot.forEach((logDoc) => {
    batch.update(logDoc.ref, { username: newUsername });
  });

  // 4. CASCADE STANDALONE PUSH TOKENS DOCUMENT
  const oldPushTokensDocRef = db.collection('push_tokens').doc(oldUsername);
  const oldPushTokensDoc = await oldPushTokensDocRef.get();
  if (oldPushTokensDoc.exists) {
    const newPushTokensDocRef = db.collection('push_tokens').doc(newUsername);
    batch.set(newPushTokensDocRef, oldPushTokensDoc.data() || {});
    batch.delete(oldPushTokensDocRef);
  }

  // 5. MIGRATE INCOMING USER NOTIFICATION INBOX ENTRIES
  const notificationsSnapshot = await db.collection('notifications').doc(oldUsername).collection('items').get();
  notificationsSnapshot.forEach((doc) => {
    batch.set(db.collection('notifications').doc(newUsername).collection('items').doc(doc.id), doc.data() || {});
    batch.delete(doc.ref);
  });
  batch.delete(db.collection('notifications').doc(oldUsername));

  // 6. SAFE AI SUGGESTIONS MIGRATION
  const oldAiSuggestionsRef = db.collection('ai_suggestions').doc(oldUsername);
  const oldAiSuggestionsDoc = await oldAiSuggestionsRef.get();
  if (oldAiSuggestionsDoc.exists) {
    const aiData = oldAiSuggestionsDoc.data();
    if (aiData && Object.keys(aiData).length > 0) {
      const newAiSuggestionsRef = db.collection('ai_suggestions').doc(newUsername);
      batch.set(newAiSuggestionsRef, aiData);
      batch.delete(oldAiSuggestionsRef);
    }
  }

  // 7. SAFE MEAL PLANS MIGRATION
  const oldMealPlansRef = db.collection('meal_plans').doc(oldUsername);
  const oldMealPlansDoc = await oldMealPlansRef.get();
  if (oldMealPlansDoc.exists) {
    const mealData = oldMealPlansDoc.data();
    if (mealData && Object.keys(mealData).length > 0) {
      const newMealPlansRef = db.collection('meal_plans').doc(newUsername);
      batch.set(newMealPlansRef, mealData);
      batch.delete(oldMealPlansRef);
    }
  }

  // 8. RE-CREATE THE MAIN USER DOCUMENT AND DELETE THE OLD ONE
  const newUsernameRef = db.collection('users').doc(newUsername);
  batch.set(newUsernameRef, migratedProfileData);
  batch.delete(db.collection('users').doc(oldUsername));

  await batch.commit();
  console.log(`>>> Global username migration cascade completely synchronized: ${newUsername} <<<`);
}

module.exports = async (req, res) => {
  if (req.method !== 'PATCH') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!db) {
    res.status(500).json({ error: 'Database not initialized. Check Firebase credentials.' });
    return;
  }

  const normalizeProfileUpdates = (updates) => {
    const normalized = { ...updates };
    if (normalized.profile_photo_url !== undefined && normalized.profilePhotoUrl === undefined) {
      normalized.profilePhotoUrl = normalized.profile_photo_url;
    }
    if (normalized.kitchen_persona !== undefined && normalized.kitchenPersona === undefined) {
      normalized.kitchenPersona = normalized.kitchen_persona;
    }
    if (normalized.top_dishes !== undefined && normalized.topDishes === undefined) {
      normalized.topDishes = normalized.top_dishes;
    }
    if (normalized.favorite_ingredients !== undefined && normalized.favoriteIngredients === undefined) {
      normalized.favoriteIngredients = normalized.favorite_ingredients;
    }
    if (normalized.cooking_stats !== undefined && normalized.cookingStats === undefined) {
      normalized.cookingStats = normalized.cooking_stats;
    }

    delete normalized.profile_photo_url;
    delete normalized.kitchen_persona;
    delete normalized.top_dishes;
    delete normalized.favorite_ingredients;
    delete normalized.cooking_stats;

    return normalized;
  };

  const oldUsername = normalizeUsername(req.body.username);
  const auth = await requireAuthForUsername(req, res, oldUsername);
  if (!auth) return;

  const { username, newUsername, ...rawUpdates } = req.body;
  const updates = pickProfileUpdates(normalizeProfileUpdates(rawUpdates)) || {};

  const requestedNewUsername = normalizeUsername(newUsername);
  const wantsUsernameChange = requestedNewUsername && requestedNewUsername !== oldUsername;

  if (!updates) {
    res.status(400).json({ error: 'Invalid profile update fields' });
    return;
  }

  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  if (Object.keys(updates).length === 0 && !wantsUsernameChange) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  try {
    const userRef = db.collection('users').doc(oldUsername);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

        const currentProfileData = userDoc.data() || {};

    // =========================================================================
    // SECTION 3: ATOMIC USERNAME MIGRATION ROUTINE LAYER
    // =========================================================================
    if (wantsUsernameChange) {
      const newUsernameRef = db.collection('users').doc(requestedNewUsername);
      const newUsernameDoc = await newUsernameRef.get();
      
      // Uniqueness check: stop execution if requested handle is occupied
      if (newUsernameDoc.exists) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      // ---------------------------------------------------------------------
      // 🚨 GUARDRAIL: Limit username updates to a maximum of 2 times per 14 days
      // ---------------------------------------------------------------------
      const nowMs = Date.now();
      const fourteenDaysAgoMs = nowMs - 14 * 24 * 60 * 60 * 1000; // Time milestone limit boundary

      // Extract your legacy arrays or initialize as empty
      let changeHistory = Array.isArray(currentProfileData.usernameChangeHistory) 
        ? currentProfileData.usernameChangeHistory 
        : [];

      // Clean up your history: Filter out any change timestamps older than 14 days
      changeHistory = changeHistory.filter((timestampStr) => {
        const timestampMs = Date.parse(timestampStr);
        return !isNaN(timestampMs) && timestampMs > fourteenDaysAgoMs;
      });

      // If they have already changed it twice within the clean window, block the transaction
      if (changeHistory.length >= 2) {
        res.status(429).json({ 
          error: 'Rate limit exceeded',
          message: 'You can only change your username twice every 14 days.' 
        });
        return;
      }

      // Append the current update time event record to your tracking queue
      changeHistory.push(new Date().toISOString());
      // ---------------------------------------------------------------------

      // Compile and merge the updated profile parameters safely
      const displayName = updates.name || currentProfileData.name || '';
      const migratedProfileData = {
        ...currentProfileData,
        ...updates,
        username: requestedNewUsername,
        nameLower: displayName.toLowerCase(),
        usernameChangeHistory: changeHistory, // Save the updated rate limit array
        updatedAt: new Date().toISOString()
      };

      // Preserve portfolio showcase highlights if present
      if (Array.isArray(currentProfileData.portfolio_favorites)) {
        migratedProfileData.portfolio_favorites = currentProfileData.portfolio_favorites;
      }

      // Fire off your background cascading social map update loop
      await cascadeUsernameSocialMigration(db, oldUsername, requestedNewUsername, migratedProfileData);
      
      res.status(200).json({ 
        message: 'Username and social charts successfully migrated', 
        username: requestedNewUsername 
      });
      return;
    }

    if (updates.kitchen_personality) {
      const existing = userDoc.data().kitchen_personality || {};
      updates.kitchen_personality = { ...existing, ...updates.kitchen_personality };

      if (Array.isArray(updates.kitchen_personality.top_cuisines)) {
        updates.kitchen_personality.top_cuisines = capitalizeList(
          updates.kitchen_personality.top_cuisines
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 3)
        );
      }
      if (Array.isArray(updates.kitchen_personality.favorite_ingredients)) {
        updates.kitchen_personality.favorite_ingredients = capitalizeList(
          updates.kitchen_personality.favorite_ingredients
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        );
      }
    }

    if (updates.kitchen_personality && updates.personality_edited_by_user !== false) {
      updates.personality_edited_by_user = true;
    }

    await userRef.update(updates);
    res.status(200).json({ message: 'User profile updated' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update user profile',
      ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
    });
  }
};
