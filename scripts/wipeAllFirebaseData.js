#!/usr/bin/env node
/**
 * Destructive: deletes ALL Firestore data (all root collections recursively)
 * and ALL Firebase Auth users. Requires serviceAccountKey.json at repo root
 * or GOOGLE_SERVICE_ACCOUNT JSON env var.
 *
 * Usage: node scripts/wipeAllFirebaseData.js --confirm
 */

const path = require('path');
const fs = require('fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const ROOT = path.resolve(__dirname, '..');

function loadServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  }
  const keyPath = path.join(ROOT, 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    console.error('Missing credentials: set GOOGLE_SERVICE_ACCOUNT or add serviceAccountKey.json at project root.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
}

async function deleteAllAuthUsers(auth) {
  let nextPageToken;
  let deleted = 0;
  let failed = 0;
  do {
    const list = await auth.listUsers(1000, nextPageToken);
    if (list.users.length === 0) break;
    const uids = list.users.map((u) => u.uid);
    const result = await auth.deleteUsers(uids);
    deleted += result.successCount;
    failed += result.failureCount;
    if (result.errors?.length) {
      for (const e of result.errors) {
        console.error('Auth delete error:', e.error?.message || e);
      }
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);
  return { deleted, failed };
}

async function wipeFirestore(db) {
  const collections = await db.listCollections();
  const names = collections.map((c) => c.id);
  const stats = {};

  for (const coll of collections) {
    process.stdout.write(`Deleting Firestore collection (recursive): ${coll.id} ... `);
    await db.recursiveDelete(coll);
    stats[coll.id] = 'recursiveDelete completed';
    console.log('done');
  }

  return { collectionNames: names, stats };
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without --confirm (this deletes ALL Firestore data and Auth users).');
    process.exit(1);
  }

  const serviceAccount = loadServiceAccount();
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const db = getFirestore();
  const auth = getAuth();

  console.log(`Project: ${serviceAccount.project_id}`);
  console.log('--- Firestore wipe ---');
  const firestoreResult = await wipeFirestore(db);

  console.log('--- Firebase Auth wipe ---');
  const authResult = await deleteAllAuthUsers(auth);

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({ firestore: firestoreResult, auth: authResult }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
