#!/usr/bin/env ts-node
/**
 * Glide -> Firebase Migration Script
 * Imports users and shipments from Glide CSV exports to Firebase.
 *
 * Usage: npx ts-node scripts/migrate-glide-data.ts [--dry-run] [--users-only] [--shipments-only]
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

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: 'mooviz-app-9b766.appspot.com',
});

const db = admin.firestore();
const auth = admin.auth();

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

async function migrateUsers(dryRun: boolean): Promise<Map<string, string>> {
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

    if (!email) {
      stats.errors.push(`Row ${stats.usersProcessed}: missing email`);
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

        // Create Firestore user document
        await db.collection('users').doc(uid).set({
          uid,
          fullName: name || '',
          email,
          phone: phone ? normalizePhone(phone) : '',
          city: '',
          profilePhotoURL: row['ProfilePhoto'] || '',
          kycDocumentURL: row['DriverLicensePhoto'] || '',
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
          migratedFrom: 'glide',
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

        console.log(`  [OK] Created: ${email} (${name}) ${isDriver ? '[DRIVER]' : ''}`);
      }

      emailToUid.set(email, uid);
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
  return emailToUid;
}

// -- Shipment Migration -------------------------------------------------------
async function migrateShipments(emailToUid: Map<string, string>, dryRun: boolean): Promise<void> {
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

      await db.collection('deliveries').add({
        senderId,
        driverId: driverId || null,
        status,
        pickup: {
          address: row['PickupAddress']?.trim() || '',
          city: '',
          lat: 0,
          lng: 0,
          geohash: '',
        },
        destination: {
          address: row['DropoffAddress']?.trim() || '',
          city: '',
          lat: 0,
          lng: 0,
          geohash: '',
        },
        item: {
          description: row['ItemDescription']?.trim() || '',
          type: 'general',
          size: mapItemSize(row['Item Size']?.trim() || ''),
          photoURL: row['ItemPhoto']?.trim() || '',
        },
        price: parseFloat(row['Price']?.trim() || '0') || 0,
        pickupDate: scheduledDate ? admin.firestore.Timestamp.fromDate(new Date(scheduledDate)) : 'asap',
        notes: '',
        payment: { senderConfirmed: status === 'completed_paid', driverConfirmed: status === 'completed_paid' },
        proof: {},
        statusHistory: [{
          status,
          timestamp: now,
          actor: 'migration',
          note: 'Imported from Glide',
        }],
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

    const deliveryId = deliveryQuery.docs[0].id;
    const chatRef = db.collection('chats').doc(deliveryId);

    // Get participants from first message
    const participantStr = msgs[0]['User , Driver'] || '';
    const participantEmails = participantStr.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
    const participantUids = participantEmails
      .map((email: string) => emailToUid.get(email) || '')
      .filter(Boolean);

    // Create chat document
    const sortedMsgs = msgs.sort((a, b) =>
      new Date(a['SentAt'] || 0).getTime() - new Date(b['SentAt'] || 0).getTime()
    );
    const lastMsg = sortedMsgs[sortedMsgs.length - 1];

    await chatRef.set({
      deliveryId,
      participants: participantUids,
      lastMessage: lastMsg['MessageContent'] || '',
      lastMessageAt: lastMsg['SentAt']
        ? admin.firestore.Timestamp.fromDate(new Date(lastMsg['SentAt']))
        : admin.firestore.Timestamp.now(),
      lastSenderId: emailToUid.get(lastMsg['Comment User']?.trim().toLowerCase() || '') || '',
      migratedFrom: 'glide',
      createdAt: admin.firestore.Timestamp.now(),
    });

    // Add messages as subcollection
    const batch = db.batch();
    let batchCount = 0;

    for (const msg of sortedMsgs) {
      const senderEmail = msg['Comment User']?.trim().toLowerCase();
      const senderId = emailToUid.get(senderEmail || '') || '';

      const msgRef = chatRef.collection('messages').doc();
      batch.set(msgRef, {
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

      // Firestore batch limit is 500
      if (batchCount >= 450) {
        await batch.commit();
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

  if (dryRun) {
    console.log('DRY RUN MODE -- no data will be written');
  }

  let emailToUid: Map<string, string>;

  if (shipmentsOnly) {
    // Still need user mapping for sender/driver lookup
    emailToUid = await migrateUsers(dryRun);
    await migrateShipments(emailToUid, dryRun);
  } else if (usersOnly) {
    emailToUid = await migrateUsers(dryRun);
  } else {
    emailToUid = await migrateUsers(dryRun);
    await migrateShipments(emailToUid, dryRun);
    await migrateMessages(emailToUid, dryRun);
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
