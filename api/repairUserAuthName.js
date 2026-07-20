const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let authAdmin;
try {
  if (!getApps().length) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set');
    }
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  authAdmin = getAuth();
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

module.exports = async (req, res) => {
  // Replace these placeholders with your actual user details before pushing!
  const targetEmail = "roshpaul117@gmail.com"; // <-- Change to your test account email
  const correctNewUsername = "ocean_roshan7";        // <-- Change to your exact new username handle string

  if (!authAdmin) {
    return res.status(500).json({ error: 'Auth service not initialized.' });
  }

  try {
    // 1. Locate the authentication user record by their registered email address
    const userRecord = await authAdmin.getUserByEmail(targetEmail.trim().toLowerCase());
    
    // 2. Clear out the old 'rosh' token data string by overwriting displayName cloud-side
    await authAdmin.updateUser(userRecord.uid, {
      displayName: correctNewUsername.trim().toLowerCase()
    });

    console.log(`>>> Successfully repaired Firebase Auth cloud record for ${targetEmail}. Set displayName to ${correctNewUsername} <<<`);
    
    return res.status(200).json({
      status: 'success',
      message: `Successfully synchronized Firebase Authentication account record. Username token updated to '${correctNewUsername}'.`
    });

  } catch (err) {
    console.error('Auth update script failed:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
