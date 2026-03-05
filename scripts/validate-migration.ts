#!/usr/bin/env ts-node
/**
 * Post-migration validation script.
 * Checks that all Glide data was imported correctly.
 *
 * Usage: npx ts-node scripts/validate-migration.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function validate(): Promise<void> {
  console.log('=== Migration Validation ===\n');

  // Count migrated users
  const migratedUsers = await db.collection('users')
    .where('migratedFrom', '==', 'glide')
    .count()
    .get();
  console.log(`Migrated users: ${migratedUsers.data().count}`);

  // Count users missing phone
  const noPhone = await db.collection('users')
    .where('migratedFrom', '==', 'glide')
    .where('phone', '==', '')
    .count()
    .get();
  console.log(`Users missing phone: ${noPhone.data().count}`);

  // Count users with driver license
  const withLicense = await db.collection('users')
    .where('migratedFrom', '==', 'glide')
    .where('kycDocumentURL', '!=', '')
    .count()
    .get();
  console.log(`Users with driver license: ${withLicense.data().count}`);

  // Count deliveries
  const deliveries = await db.collection('deliveries')
    .where('migratedFrom', '==', 'glide')
    .count()
    .get();
  console.log(`Migrated deliveries: ${deliveries.data().count}`);

  // Count chat documents
  const chats = await db.collection('chats')
    .where('migratedFrom', '==', 'glide')
    .count()
    .get();
  console.log(`Migrated chats: ${chats.data().count}`);

  // Check for users without Firestore docs
  const authUsers = await admin.auth().listUsers(1000);
  let orphanCount = 0;
  for (const user of authUsers.users) {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      orphanCount++;
      console.log(`  [WARN] Auth user ${user.email} has no Firestore doc`);
    }
  }
  console.log(`\nOrphan auth users (no Firestore doc): ${orphanCount}`);

  console.log('\nValidation complete!');
}

validate().catch(console.error);
