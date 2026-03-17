#!/usr/bin/env ts-node
/**
 * Glide -> Firebase Migration Script
 * Imports users and shipments from Glide CSV exports to Firebase.
 * Updated to match current data model (Sprint 3 / M3).
 *
 * Usage: npx ts-node scripts/migrate-glide-data.ts [--dry-run] [--users-only] [--shipments-only]
 *
 * Environment:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
 *   FIREBASE_STORAGE_BUCKET=mooviz-app-9b766.appspot.com (or mooviz-prod.firebasestorage.app)
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccount) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS env var to your Firebase service account key path');
  process.exit(1);
}

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'mooviz-app-9b766.appspot.com';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket,
});

const db = admin.firestore();
const auth = admin.auth();

// -- Geohash Encoding (inline, matches functions/src/services/geohashService.ts) --
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(latitude: number, longitude: number, precision = 7): string {
  if (!latitude || !longitude || latitude === 0 || longitude === 0) return '';
  let latRange = { min: -90, max: 90 };
  let lonRange = { min: -180, max: 180 };
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isEven = true;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonRange.min + lonRange.max) / 2;
      if (longitude >= mid) { ch |= 1 << (4 - bit); lonRange.min = mid; }
      else { lonRange.max = mid; }
    } else {
      const mid = (latRange.min + latRange.max) / 2;
      if (latitude >= mid) { ch |= 1 << (4 - bit); latRange.min = mid; }
      else { latRange.max = mid; }
    }
    isEven = !isEven;
    bit++;
    if (bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

// -- CSV Parsing (simple, no external deps) -----------------------------------
function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header.trim()] = (values[i] || '').trim();
    });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// -- Phone normalization ------------------------------------------------------
function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('0')) cleaned = '+972' + cleaned.substring(1);
  if (!cleaned.startsWith('+')) cleaned = '+972' + cleaned;
  return cleaned;
}

// -- Hebrew status mapping ----------------------------------------------------
function mapHebrewStatus(hebrewStatus: string): string {
  const statusMap: Record<string, string> = {
    '\u05D7\u05D3\u05E9': 'new',
    '\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8': 'pending',
    '\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E1\u05D5\u05E3': 'waiting',
    '\u05E0\u05D0\u05E1\u05E3': 'picked_up',
    '\u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E0\u05DE\u05E1\u05E8': 'delivered',
    '\u05E0\u05DE\u05E1\u05E8': 'delivered',
    '\u05D1\u05D5\u05D8\u05DC': 'cancelled',
    '\u05D4\u05D5\u05E9\u05DC\u05DD \u05D5\u05E9\u05D5\u05DC\u05DD': 'completed_paid',
  };
  return statusMap[hebrewStatus] || 'completed_paid';
}

// -- Item size mapping --------------------------------------------------------
function mapItemSize(hebrewSize: string): string {
  const sizeMap: Record<string, string> = {
    '\u05E7\u05D8\u05DF': 'small',
    '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9': 'medium',
    '\u05D2\u05D3\u05D5\u05DC': 'large',
  };
  return sizeMap[hebrewSize] || 'small';
}

// -- User Migration -----------------------------------------------------------
interface MigrationStats {
  usersProcessed: number;
  usersCreated: number;
  usersSkipped: number;
  shipmentsProcessed: number;
  shipmentsCreated: number;
  messagesProcessed: number;
  messagesCreated: number;
  errors: string[];
}

/** Stores uid → { fullName, profilePhotoURL, ratingAsSender } for denormalization */
interface UserInfo {
  uid: string;
  fullName: string;
  profilePhotoURL: string;
  ratingAsSender: number;
  ratingAsDriver: number;
}

async function migrateUsers(dryRun: boolean): Promise<{ emailToUid: Map<string, string>; userInfoMap: Map<string, UserInfo> }> {
  console.log('\n=== Migrating Users ===');

  const csvPath = path.resolve(__dirname, '../Docs/client/DB/5c3136.User Registrations.csv');
  const usersDbPath = path.resolve(__dirname, '../Docs/client/DB/Users-Db table.csv');

  const registrations = parseCSV(csvPath);
  const usersDb = parseCSV(usersDbPath);

  // Build driver lookup from Users-Db table
  const driverEmails = new Set<string>();
  usersDb.forEach(row => {
    if (row['User Courier Filter'] === 'true') {
      driverEmails.add(row['Email']?.trim().toLowerCase());
    }
  });

  console.log(`Found ${registrations.length} registrations, ${driverEmails.size} drivers`);

  const emailToUid = new Map<string, string>();
  const userInfoMap = new Map<string, UserInfo>();
  const stats: MigrationStats = {
    usersProcessed: 0,
    usersCreated: 0,
    usersSkipped: 0,
    shipmentsProcessed: 0,
    shipmentsCreated: 0,
    messagesProcessed: 0,
    messagesCreated: 0,
    errors: [],
  };

  for (const row of registrations) {
    stats.usersProcessed++;
    const email = row['Email']?.trim().toLowerCase();
    const name = row['Name']?.trim();
    const phone = row['PhoneNumber']?.trim();
    const role = row['Role']?.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      stats.usersSkipped++;
      continue;
    }

    try {
      // Check if user already exists in Firebase Auth
      let uid: string;
      try {
        const existingUser = await auth.getUserByEmail(email);
        uid = existingUser.uid;
        console.log(`  [SKIP] ${email} already exists (uid: ${uid})`);
        emailToUid.set(email, uid);

        // Still need user info for denormalization — fetch from Firestore
        const existingDoc = await db.collection('users').doc(uid).get();
        if (existingDoc.exists) {
          const d = existingDoc.data()!;
          userInfoMap.set(uid, {
            uid,
            fullName: d.fullName || name || '',
            profilePhotoURL: d.profilePhotoURL || '',
            ratingAsSender: d.ratingAsSender?.average || 0,
            ratingAsDriver: d.ratingAsDriver?.average || 0,
          });
        }

        stats.usersSkipped++;
        continue;
      } catch {
        // User doesn't exist, create them
      }

      if (dryRun) {
        uid = `dry-run-${stats.usersProcessed}`;
        console.log(`  [DRY] Would create: ${email} (${name})`);
      } else {
        // Create Firebase Auth user (email only, no password -- migrated users use password reset)
        const authUser = await auth.createUser({
          email,
          displayName: name || undefined,
          phoneNumber: phone ? normalizePhone(phone) : undefined,
          disabled: false,
        });
        uid = authUser.uid;

        const isDriver = driverEmails.has(email) || role === 'Driver';
        const now = admin.firestore.Timestamp.now();

        // Create Firestore user document — matches current userCallable.ts structure
        await db.collection('users').doc(uid).set({
          uid,
          fullName: name || '',
          email,
          phone: phone ? normalizePhone(phone) : '',
          city: '',
          profilePhotoURL: row['ProfilePhoto'] || '',
          kycDocumentURL: row['DriverLicensePhoto'] || '',
          kycIdURL: null,
          kycStatus: 'pending' as const,
          ratingAsDriver: { average: 0, count: 0 },
          ratingAsSender: { average: 0, count: 0 },
          completedDeliveries: 0,
          status: 'active' as const,
          fcmTokens: [],
          location: { lat: 0, lng: 0, geohash: '' },
          activeMode: isDriver ? 'driver' : 'client',
          driverAvailable: false,
          driverUnlocked: isDriver,
          role: 'sender' as const, // All migrated users start as sender — driver requires KYC approval
          migratedFrom: 'glide',
          createdAt: now,
          updatedAt: now,
        });

        console.log(`  [OK] Created: ${email} (${name}) ${isDriver ? '[driver-eligible]' : ''}`);
      }

      emailToUid.set(email, uid);
      userInfoMap.set(uid, {
        uid,
        fullName: name || '',
        profilePhotoURL: row['ProfilePhoto'] || '',
        ratingAsSender: 0,
        ratingAsDriver: 0,
      });
      stats.usersCreated++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      stats.errors.push(`${email}: ${message}`);
      stats.usersSkipped++;
    }
  }

  console.log(`\nUsers: ${stats.usersCreated} created, ${stats.usersSkipped} skipped, ${stats.errors.length} errors`);
  if (stats.errors.length > 0) {
    console.log('Errors:');
    stats.errors.forEach(e => console.log(`  ${e}`));
  }
  return { emailToUid, userInfoMap };
}

// -- Shipment Migration -------------------------------------------------------
async function migrateShipments(
  emailToUid: Map<string, string>,
  userInfoMap: Map<string, UserInfo>,
  dryRun: boolean,
): Promise<void> {
  console.log('\n=== Migrating Shipments ===');

  const csvPath = path.resolve(__dirname, '../Docs/client/DB/e4d133.Shipments.csv');
  const shipments = parseCSV(csvPath);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of shipments) {
    const glideId = row['\uD83D\uDD12 Row ID']?.trim();
    const senderEmail = row['Sender  Email']?.trim().toLowerCase();
    const driverEmail = row['Assigned Driver']?.trim().toLowerCase();

    const senderId = emailToUid.get(senderEmail || '') || '';
    const driverId = emailToUid.get(driverEmail || '') || '';

    if (!senderId) {
      errors.push(`Shipment ${glideId}: sender ${senderEmail} not found`);
      skipped++;
      continue;
    }

    const status = mapHebrewStatus(row['Status']?.trim() || '');

    if (dryRun) {
      console.log(`  [DRY] Would create shipment: ${row['ItemDescription']} (${status})`);
      created++;
      continue;
    }

    try {
      const now = admin.firestore.Timestamp.now();
      const scheduledDate = row['ScheduledPickup']?.trim();

      // Parse coordinates for geohash computation
      const pickupLat = parseFloat(row['PickupLat']?.trim() || '0') || 0;
      const pickupLng = parseFloat(row['PickupLng']?.trim() || '0') || 0;
      const destLat = parseFloat(row['DropoffLat']?.trim() || '0') || 0;
      const destLng = parseFloat(row['DropoffLng']?.trim() || '0') || 0;

      // Denormalize sender info
      const senderInfo = userInfoMap.get(senderId);
      const driverInfo = driverId ? userInfoMap.get(driverId) : null;

      await db.collection('deliveries').add({
        senderId,
        senderName: senderInfo?.fullName || '',
        senderPhotoUrl: senderInfo?.profilePhotoURL || null,
        senderRating: senderInfo?.ratingAsSender ?? null,
        driverId: driverId || null,
        driverName: driverInfo?.fullName || null,
        driverPhotoUrl: driverInfo?.profilePhotoURL || null,
        driverRating: driverInfo?.ratingAsDriver || null,
        status,
        pickup: {
          address: row['PickupAddress']?.trim() || '',
          city: '',
          lat: pickupLat,
          lng: pickupLng,
          geohash: encodeGeohash(pickupLat, pickupLng),
        },
        destination: {
          address: row['DropoffAddress']?.trim() || '',
          city: '',
          lat: destLat,
          lng: destLng,
          geohash: encodeGeohash(destLat, destLng),
        },
        item: {
          description: row['ItemDescription']?.trim() || '',
          type: 'general',
          size: mapItemSize(row['Item Size']?.trim() || ''),
          photoURL: row['ItemPhoto']?.trim() || '',
        },
        mediaURLs: [],
        price: parseFloat(row['Price']?.trim() || '0') || 0,
        pickupDate: scheduledDate ? admin.firestore.Timestamp.fromDate(new Date(scheduledDate)) : 'asap',
        timeRange: null,
        notes: '',
        payment: { senderConfirmed: status === 'completed_paid', driverConfirmed: status === 'completed_paid' },
        proof: {},
        statusHistory: [{
          status,
          timestamp: now,
          actor: 'migration',
          note: 'Imported from Glide',
        }],
        interestedDrivers: [],
        selectedDriverId: null,
        selectionExpiresAt: null,
        ratedBySender: status === 'completed_paid' ? false : null,
        ratedByDriver: status === 'completed_paid' ? false : null,
        ratingsVisibleAt: null,
        migratedFrom: 'glide',
        glideId,
        timeoutAt: now,
        createdAt: now,
        updatedAt: now,
      });

      created++;
      console.log(`  [OK] Shipment: ${row['ItemDescription']?.trim()} (${status})`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Shipment ${glideId}: ${message}`);
      skipped++;
    }
  }

  console.log(`\nShipments: ${created} created, ${skipped} skipped, ${errors.length} errors`);
  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  ${e}`));
  }
}

// -- Message Migration --------------------------------------------------------
async function migrateMessages(emailToUid: Map<string, string>, dryRun: boolean): Promise<void> {
  console.log('\n=== Migrating Messages ===');

  const csvPath = path.resolve(__dirname, '../Docs/client/DB/b7a786.In-App Messages.csv');
  const messages = parseCSV(csvPath);

  let created = 0;
  let skipped = 0;

  // Group messages by Chat ID (which is the shipment Row ID)
  const chatGroups = new Map<string, typeof messages>();
  for (const msg of messages) {
    const chatId = msg['Chat ID']?.trim();
    if (!chatId) { skipped++; continue; }
    if (!chatGroups.has(chatId)) chatGroups.set(chatId, []);
    chatGroups.get(chatId)!.push(msg);
  }

  console.log(`Found ${chatGroups.size} chat groups from ${messages.length} messages`);

  for (const [chatId, msgs] of chatGroups) {
    if (dryRun) {
      created += msgs.length;
      console.log(`  [DRY] Would create ${msgs.length} messages for delivery ${chatId}`);
      continue;
    }

    // Find the delivery doc by glideId
    const deliveryQuery = await db.collection('deliveries')
      .where('glideId', '==', chatId)
      .limit(1)
      .get();

    if (deliveryQuery.empty) {
      skipped += msgs.length;
      continue;
    }

    const deliveryDoc = deliveryQuery.docs[0];
    const deliveryId = deliveryDoc.id;
    const deliveryData = deliveryDoc.data();
    const chatRef = db.collection('chats').doc(deliveryId);

    // Get participants from first message
    const participantStr = msgs[0]['User , Driver'] || '';
    const participantEmails = participantStr.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
    const participantUids = participantEmails
      .map((email: string) => emailToUid.get(email) || '')
      .filter(Boolean);

    // Sort messages by date
    const sortedMsgs = msgs.sort((a, b) =>
      new Date(a['SentAt'] || 0).getTime() - new Date(b['SentAt'] || 0).getTime()
    );
    const lastMsg = sortedMsgs[sortedMsgs.length - 1];

    // Determine if chat should be closed (completed/cancelled deliveries)
    const isClosed = ['completed_paid', 'cancelled'].includes(deliveryData.status);

    // Create chat document — matches current chat model with auto-close fields
    await chatRef.set({
      deliveryId,
      participants: participantUids,
      lastMessage: lastMsg['MessageContent'] || '',
      lastMessageAt: lastMsg['SentAt']
        ? admin.firestore.Timestamp.fromDate(new Date(lastMsg['SentAt']))
        : admin.firestore.Timestamp.now(),
      lastSenderId: emailToUid.get(lastMsg['Comment User']?.trim().toLowerCase() || '') || '',
      closed: isClosed,
      chatCloseAt: isClosed ? admin.firestore.Timestamp.now() : null,
      closedAt: isClosed ? admin.firestore.Timestamp.now() : null,
      migratedFrom: 'glide',
      createdAt: admin.firestore.Timestamp.now(),
    });

    // Add messages as subcollection
    let batch = db.batch();
    let batchCount = 0;

    for (const msg of sortedMsgs) {
      const senderEmail = msg['Comment User']?.trim().toLowerCase();
      const senderId = emailToUid.get(senderEmail || '') || '';

      const msgRef = chatRef.collection('messages').doc();
      batch.set(msgRef, {
        chatId: deliveryId,
        senderId,
        text: msg['MessageContent'] || '',
        type: 'text',
        read: msg['IsRead'] === 'true',
        createdAt: msg['SentAt']
          ? admin.firestore.Timestamp.fromDate(new Date(msg['SentAt']))
          : admin.firestore.Timestamp.now(),
      });

      batchCount++;
      created++;

      // Firestore batch limit is 500; create new batch after commit
      if (batchCount >= 450) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  console.log(`\nMessages: ${created} created, ${skipped} skipped`);
}

// -- Main ---------------------------------------------------------------------
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const usersOnly = args.includes('--users-only');
  const shipmentsOnly = args.includes('--shipments-only');

  console.log('========================================');
  console.log('  MOOVIZ -- Glide to Firebase Migration');
  console.log('========================================');
  console.log(`  Storage bucket: ${storageBucket}`);

  if (dryRun) {
    console.log('DRY RUN MODE -- no data will be written');
  }

  let emailToUid: Map<string, string>;
  let userInfoMap: Map<string, UserInfo>;

  if (shipmentsOnly) {
    // Still need user mapping for sender/driver lookup
    ({ emailToUid, userInfoMap } = await migrateUsers(dryRun));
    await migrateShipments(emailToUid, userInfoMap, dryRun);
  } else if (usersOnly) {
    ({ emailToUid } = await migrateUsers(dryRun));
  } else {
    ({ emailToUid, userInfoMap } = await migrateUsers(dryRun));
    await migrateShipments(emailToUid, userInfoMap, dryRun);
    await migrateMessages(emailToUid, dryRun);
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
