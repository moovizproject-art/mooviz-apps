#!/usr/bin/env ts-node
/**
 * Post-migration validation script.
 * Checks that all Glide data was imported correctly and matches current data model.
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

  let issues = 0;

  // ── Users ──
  const migratedUsers = await db.collection('users')
    .where('migratedFrom', '==', 'glide')
    .get();
  console.log(`Migrated users: ${migratedUsers.size}`);

  let noPhone = 0;
  let noEmail = 0;
  let withLicense = 0;
  let missingFields = 0;

  for (const doc of migratedUsers.docs) {
    const d = doc.data();
    if (!d.phone) noPhone++;
    if (!d.email) noEmail++;
    if (d.kycDocumentURL) withLicense++;

    // Check required fields exist
    const requiredFields = ['uid', 'fullName', 'role', 'activeMode', 'status', 'kycStatus', 'fcmTokens', 'location', 'ratingAsDriver', 'ratingAsSender', 'createdAt'];
    for (const field of requiredFields) {
      if (d[field] === undefined) {
        console.log(`  [WARN] User ${doc.id} (${d.email}) missing field: ${field}`);
        missingFields++;
        issues++;
      }
    }
  }

  console.log(`  Missing phone: ${noPhone}`);
  console.log(`  Missing email: ${noEmail}`);
  console.log(`  With driver license: ${withLicense}`);
  console.log(`  Missing required fields: ${missingFields}`);

  // ── Deliveries ──
  const deliveries = await db.collection('deliveries')
    .where('migratedFrom', '==', 'glide')
    .get();
  console.log(`\nMigrated deliveries: ${deliveries.size}`);

  let noGeohash = 0;
  let noSenderName = 0;
  let noInterestedDrivers = 0;
  let noMediaURLs = 0;
  let orphanSenders = 0;
  let orphanDrivers = 0;

  for (const doc of deliveries.docs) {
    const d = doc.data();

    // Check geohash
    if (!d.pickup?.geohash && (d.pickup?.lat || d.pickup?.lng)) {
      noGeohash++;
      issues++;
    }

    // Check denormalized fields
    if (!d.senderName) noSenderName++;
    if (!Array.isArray(d.interestedDrivers)) noInterestedDrivers++;
    if (!Array.isArray(d.mediaURLs)) noMediaURLs++;

    // Check sender exists
    if (d.senderId) {
      const senderDoc = await db.collection('users').doc(d.senderId).get();
      if (!senderDoc.exists) {
        console.log(`  [WARN] Delivery ${doc.id}: sender ${d.senderId} not found`);
        orphanSenders++;
        issues++;
      }
    }

    // Check driver exists (if assigned)
    if (d.driverId) {
      const driverDoc = await db.collection('users').doc(d.driverId).get();
      if (!driverDoc.exists) {
        console.log(`  [WARN] Delivery ${doc.id}: driver ${d.driverId} not found`);
        orphanDrivers++;
        issues++;
      }
    }
  }

  console.log(`  Missing geohash (with coords): ${noGeohash}`);
  console.log(`  Missing senderName: ${noSenderName}`);
  console.log(`  Missing interestedDrivers array: ${noInterestedDrivers}`);
  console.log(`  Missing mediaURLs array: ${noMediaURLs}`);
  console.log(`  Orphan senders: ${orphanSenders}`);
  console.log(`  Orphan drivers: ${orphanDrivers}`);

  // ── Chats ──
  const chats = await db.collection('chats')
    .where('migratedFrom', '==', 'glide')
    .get();
  console.log(`\nMigrated chats: ${chats.size}`);

  let noClosed = 0;
  let noChatCloseAt = 0;
  let noDeliveryLink = 0;

  for (const doc of chats.docs) {
    const d = doc.data();
    if (d.closed === undefined) { noClosed++; issues++; }
    if (d.chatCloseAt === undefined) { noChatCloseAt++; issues++; }

    // Check linked delivery exists
    const deliveryDoc = await db.collection('deliveries').doc(doc.id).get();
    if (!deliveryDoc.exists) {
      console.log(`  [WARN] Chat ${doc.id}: linked delivery not found`);
      noDeliveryLink++;
      issues++;
    }
  }

  console.log(`  Missing 'closed' field: ${noClosed}`);
  console.log(`  Missing 'chatCloseAt' field: ${noChatCloseAt}`);
  console.log(`  Orphan chats (no delivery): ${noDeliveryLink}`);

  // ── Orphan Auth Users ──
  console.log('\n--- Auth User Consistency ---');
  const authUsers = await admin.auth().listUsers(1000);
  let orphanCount = 0;
  for (const user of authUsers.users) {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      orphanCount++;
      console.log(`  [WARN] Auth user ${user.email} has no Firestore doc`);
      issues++;
    }
  }
  console.log(`Orphan auth users (no Firestore doc): ${orphanCount}`);

  // ── Summary ──
  console.log('\n========================================');
  if (issues === 0) {
    console.log('✅ Validation PASSED — no issues found');
  } else {
    console.log(`⚠️  Validation found ${issues} issue(s) — review above`);
  }
  console.log('========================================');
}

validate().catch(console.error);
