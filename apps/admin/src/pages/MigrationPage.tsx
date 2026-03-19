import { useState, useRef } from 'react';
import { collection, doc, setDoc, addDoc, writeBatch, Timestamp, query, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useI18n } from '../i18n/I18nContext';

// -- CSV Parsing (browser) ----------------------------------------------------
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(line => line.trim());
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
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// -- Helpers ------------------------------------------------------------------
function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('0')) cleaned = '+972' + cleaned.substring(1);
  if (!cleaned.startsWith('+')) cleaned = '+972' + cleaned;
  return cleaned;
}

function mapHebrewStatus(hebrewStatus: string): string {
  const statusMap: Record<string, string> = {
    '\u05D7\u05D3\u05E9': 'new',
    '\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8': 'pending',
    '\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E1\u05D5\u05E3': 'waiting_for_pickup',
    '\u05E0\u05D0\u05E1\u05E3': 'picked_up',
    '\u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E0\u05DE\u05E1\u05E8': 'delivered',
    '\u05E0\u05DE\u05E1\u05E8': 'delivered',
    '\u05D1\u05D5\u05D8\u05DC': 'cancelled',
    '\u05D4\u05D5\u05E9\u05DC\u05DD \u05D5\u05E9\u05D5\u05DC\u05DD': 'completed_paid',
  };
  return statusMap[hebrewStatus] || 'completed_paid';
}

function mapItemSize(hebrewSize: string): string {
  const sizeMap: Record<string, string> = {
    '\u05E7\u05D8\u05DF': 'small',
    '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9': 'medium',
    '\u05D2\u05D3\u05D5\u05DC': 'large',
  };
  return sizeMap[hebrewSize] || 'small';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateId(): string {
  return doc(collection(db, '_')).id;
}

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

// -- Types --------------------------------------------------------------------
interface MigrationLog {
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

type Phase = 'idle' | 'users' | 'shipments' | 'messages' | 'done';

export default function MigrationPage() {
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [usersFile, setUsersFile] = useState<File | null>(null);
  const [usersDbFile, setUsersDbFile] = useState<File | null>(null);
  const [shipmentsFile, setShipmentsFile] = useState<File | null>(null);
  const [messagesFile, setMessagesFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [stats, setStats] = useState({ users: 0, shipments: 0, messages: 0, errors: 0 });
  const logRef = useRef<HTMLDivElement>(null);

  function log(type: MigrationLog['type'], message: string) {
    setLogs(prev => {
      const next = [...prev, { type, message }];
      setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
      return next;
    });
  }

  async function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async function runMigration() {
    if (!usersFile) { alert('Users CSV is required'); return; }

    setRunning(true);
    setLogs([]);
    setStats({ users: 0, shipments: 0, messages: 0, errors: 0 });

    try {
      // ── Phase 1: Users ──
      setPhase('users');
      log('info', '=== Importing Users ===');

      const usersText = await readFile(usersFile);
      const registrations = parseCSV(usersText);

      // Build driver lookup
      const driverEmails = new Set<string>();
      if (usersDbFile) {
        const usersDbText = await readFile(usersDbFile);
        const usersDb = parseCSV(usersDbText);
        usersDb.forEach(row => {
          if (row['User Courier Filter'] === 'true') {
            driverEmails.add(row['Email']?.trim().toLowerCase());
          }
        });
      }

      log('info', `Found ${registrations.length} registrations, ${driverEmails.size} drivers`);

      const emailToDocId = new Map<string, string>();
      let usersCreated = 0;
      let usersSkipped = 0;
      let errorCount = 0;

      for (const row of registrations) {
        const email = row['Email']?.trim().toLowerCase();
        const name = row['Name']?.trim();
        const phone = row['PhoneNumber']?.trim();
        const role = row['Role']?.trim();

        if (!email || !isValidEmail(email)) {
          usersSkipped++;
          continue;
        }

        // Check if already exists in Firestore by email
        try {
          const existing = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
          if (!existing.empty) {
            const existingId = existing.docs[0].id;
            emailToDocId.set(email, existingId);
            usersSkipped++;
            continue;
          }

          const isDriver = driverEmails.has(email) || role === 'Driver';
          const uid = generateId();
          const now = Timestamp.now();

          await setDoc(doc(db, 'users', uid), {
            uid,
            fullName: name || '',
            email,
            phone: phone ? normalizePhone(phone) : '',
            city: '',
            profilePhotoURL: row['ProfilePhoto'] || '',
            kycDocumentURL: row['DriverLicensePhoto'] || '',
            kycIdURL: null,
            kycStatus: 'pending',
            ratingAsDriver: { average: 0, count: 0 },
            ratingAsSender: { average: 0, count: 0 },
            completedDeliveries: 0,
            status: 'active',
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

          emailToDocId.set(email, uid);
          usersCreated++;

          if (usersCreated % 20 === 0) {
            log('info', `  Users progress: ${usersCreated} created...`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log('error', `  ${email}: ${msg}`);
          errorCount++;
        }
      }

      log('success', `Users: ${usersCreated} created, ${usersSkipped} skipped, ${errorCount} errors`);
      setStats(s => ({ ...s, users: usersCreated, errors: s.errors + errorCount }));

      // ── Phase 2: Shipments ──
      if (shipmentsFile) {
        setPhase('shipments');
        log('info', '=== Importing Shipments ===');

        const shipmentsText = await readFile(shipmentsFile);
        const shipments = parseCSV(shipmentsText);
        let shipmentsCreated = 0;
        let shipmentsSkipped = 0;

        for (const row of shipments) {
          const glideId = row['\uD83D\uDD12 Row ID']?.trim();
          const senderEmail = row['Sender  Email']?.trim().toLowerCase();
          const driverEmail = row['Assigned Driver']?.trim().toLowerCase();

          const senderId = emailToDocId.get(senderEmail || '') || '';
          const driverId = emailToDocId.get(driverEmail || '') || '';

          if (!senderId) {
            shipmentsSkipped++;
            continue;
          }

          const status = mapHebrewStatus(row['Status']?.trim() || '');
          const now = Timestamp.now();
          const scheduledDate = row['ScheduledPickup']?.trim();

          try {
            // Parse coordinates for geohash computation
            const pickupLat = parseFloat(row['PickupLat']?.trim() || '0') || 0;
            const pickupLng = parseFloat(row['PickupLng']?.trim() || '0') || 0;
            const destLat = parseFloat(row['DropoffLat']?.trim() || '0') || 0;
            const destLng = parseFloat(row['DropoffLng']?.trim() || '0') || 0;

            await addDoc(collection(db, 'deliveries'), {
              senderId,
              senderName: '', // Will be backfilled by fix script or trigger
              senderPhotoUrl: null,
              senderRating: null,
              driverId: driverId || null,
              driverName: null,
              driverPhotoUrl: null,
              driverRating: null,
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
              pickupDate: scheduledDate ? Timestamp.fromDate(new Date(scheduledDate)) : 'asap',
              timeRange: null,
              notes: '',
              payment: {
                senderConfirmed: status === 'completed_paid',
                driverConfirmed: status === 'completed_paid',
              },
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

            shipmentsCreated++;
            if (shipmentsCreated % 20 === 0) {
              log('info', `  Shipments progress: ${shipmentsCreated} created...`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log('error', `  Shipment ${glideId}: ${msg}`);
            errorCount++;
          }
        }

        log('success', `Shipments: ${shipmentsCreated} created, ${shipmentsSkipped} skipped`);
        setStats(s => ({ ...s, shipments: shipmentsCreated, errors: s.errors + errorCount }));
      }

      // ── Phase 3: Messages ──
      if (messagesFile) {
        setPhase('messages');
        log('info', '=== Importing Messages ===');

        const messagesText = await readFile(messagesFile);
        const messages = parseCSV(messagesText);

        // Group messages by Chat ID
        const chatGroups = new Map<string, Record<string, string>[]>();
        let msgSkipped = 0;
        for (const msg of messages) {
          const chatId = msg['Chat ID']?.trim();
          if (!chatId) { msgSkipped++; continue; }
          if (!chatGroups.has(chatId)) chatGroups.set(chatId, []);
          chatGroups.get(chatId)!.push(msg);
        }

        log('info', `Found ${chatGroups.size} chat groups from ${messages.length} messages`);

        let messagesCreated = 0;

        for (const [chatId, msgs] of chatGroups) {
          // Find delivery by glideId
          const deliveryQuery = await getDocs(
            query(collection(db, 'deliveries'), where('glideId', '==', chatId))
          );

          if (deliveryQuery.empty) {
            msgSkipped += msgs.length;
            continue;
          }

          const deliveryDoc = deliveryQuery.docs[0];
          const deliveryId = deliveryDoc.id;
          const deliveryData = deliveryDoc.data();
          const chatRef = doc(db, 'chats', deliveryId);

          // Get participants
          const participantStr = msgs[0]['User , Driver'] || '';
          const participantEmails = participantStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
          const participantUids = participantEmails.map(email => emailToDocId.get(email) || '').filter(Boolean);

          // Sort messages by date
          const sortedMsgs = msgs.sort((a, b) =>
            new Date(a['SentAt'] || 0).getTime() - new Date(b['SentAt'] || 0).getTime()
          );
          const lastMsg = sortedMsgs[sortedMsgs.length - 1];

          // Determine if chat should be closed (completed/cancelled deliveries)
          const isClosed = ['completed_paid', 'cancelled'].includes(deliveryData?.status || '');

          // Create chat document — matches current model with auto-close fields
          await setDoc(chatRef, {
            deliveryId,
            participants: participantUids,
            lastMessage: lastMsg['MessageContent'] || '',
            lastMessageAt: lastMsg['SentAt']
              ? Timestamp.fromDate(new Date(lastMsg['SentAt']))
              : Timestamp.now(),
            lastSenderId: emailToDocId.get(lastMsg['Comment User']?.trim().toLowerCase() || '') || '',
            closed: isClosed,
            chatCloseAt: isClosed ? Timestamp.now() : null,
            closedAt: isClosed ? Timestamp.now() : null,
            migratedFrom: 'glide',
            createdAt: Timestamp.now(),
          });

          // Write messages in batches of 450
          let batch = writeBatch(db);
          let batchCount = 0;

          for (const msg of sortedMsgs) {
            const senderEmail = msg['Comment User']?.trim().toLowerCase();
            const senderId = emailToDocId.get(senderEmail || '') || '';

            const msgRef = doc(collection(db, 'chats', deliveryId, 'messages'));
            batch.set(msgRef, {
              chatId: deliveryId,
              senderId,
              text: msg['MessageContent'] || '',
              type: 'text',
              read: msg['IsRead'] === 'true',
              createdAt: msg['SentAt']
                ? Timestamp.fromDate(new Date(msg['SentAt']))
                : Timestamp.now(),
            });

            batchCount++;
            messagesCreated++;

            if (batchCount >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }
        }

        log('success', `Messages: ${messagesCreated} created, ${msgSkipped} skipped`);
        setStats(s => ({ ...s, messages: messagesCreated }));
      }

      setPhase('done');
      log('success', '=== Migration Complete! ===');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', `Migration failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  }

  async function setupAdmin() {
    const user = auth.currentUser;
    if (!user) { alert('Not logged in'); return; }
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: user.displayName || 'Admin',
        email: user.email || '',
        phone: '',
        city: '',
        role: 'admin',
        status: 'active',
        kycStatus: 'approved',
        profilePhotoURL: '',
        kycDocumentURL: '',
        ratingAsDriver: { average: 0, count: 0 },
        ratingAsSender: { average: 0, count: 0 },
        completedDeliveries: 0,
        fcmTokens: [],
        location: { lat: 0, lng: 0, geohash: '' },
        activeMode: 'client',
        driverAvailable: false,
        driverUnlocked: false,
        passwordSetUp: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });
      setIsAdmin(true);
      log('success', `Admin role set for ${user.email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', `Failed to setup admin: ${msg}`);
    }
  }

  async function checkAdmin() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      setIsAdmin(snap.exists() && snap.data()?.role === 'admin');
    } catch {
      setIsAdmin(false);
    }
  }

  async function deleteMigratedUsers() {
    if (!confirm('Delete ALL migrated users, deliveries, and messages? This cannot be undone.')) return;
    setRunning(true);
    setLogs([]);
    log('info', '=== Deleting Migrated Data ===');

    try {
      // Delete migrated users
      const usersSnap = await getDocs(query(collection(db, 'users'), where('migratedFrom', '==', 'glide')));
      let count = 0;
      for (const d of usersSnap.docs) {
        await deleteDoc(d.ref);
        count++;
      }
      log('success', `Deleted ${count} migrated users`);

      // Delete migrated deliveries
      const delSnap = await getDocs(query(collection(db, 'deliveries'), where('migratedFrom', '==', 'glide')));
      let delCount = 0;
      for (const d of delSnap.docs) {
        await deleteDoc(d.ref);
        delCount++;
      }
      log('success', `Deleted ${delCount} migrated deliveries`);

      // Delete migrated chats
      const chatSnap = await getDocs(query(collection(db, 'chats'), where('migratedFrom', '==', 'glide')));
      let chatCount = 0;
      for (const d of chatSnap.docs) {
        await deleteDoc(d.ref);
        chatCount++;
      }
      log('success', `Deleted ${chatCount} migrated chats`);

      log('success', '=== Deletion Complete ===');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', `Delete failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  }

  // Check admin status on mount
  if (isAdmin === null) { checkAdmin(); }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('migration.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('migration.subtitle')}</p>
      </div>

      {/* Admin Setup */}
      {isAdmin === false && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-6">
          <h3 className="text-base font-semibold text-yellow-800">Admin Setup Required</h3>
          <p className="mt-1 text-sm text-yellow-700">
            Your account needs admin role to import data. Click below to set it up.
          </p>
          <button
            onClick={setupAdmin}
            className="mt-3 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
          >
            Setup Admin Role
          </button>
        </div>
      )}

      {/* File Inputs */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('migration.csvFiles')}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('migration.usersFile')} <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400">User Registrations.csv</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setUsersFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('migration.usersDbFile')}
            </label>
            <p className="text-xs text-gray-400">Users-Db table.csv ({t('migration.optional')})</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setUsersDbFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('migration.shipmentsFile')}
            </label>
            <p className="text-xs text-gray-400">Shipments.csv ({t('migration.optional')})</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setShipmentsFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('migration.messagesFile')}
            </label>
            <p className="text-xs text-gray-400">In-App Messages.csv ({t('migration.optional')})</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setMessagesFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={runMigration}
            disabled={running || !usersFile}
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {running ? t('migration.running') : t('migration.run')}
          </button>
          <button
            onClick={deleteMigratedUsers}
            disabled={running}
            className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {t('migration.deleteAll')}
          </button>
          {phase !== 'idle' && (
            <span className="text-sm text-gray-500">
              {phase === 'done' ? t('migration.complete') : `${t('migration.phase')}: ${phase}`}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {(stats.users > 0 || stats.shipments > 0 || stats.messages > 0) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{stats.users}</p>
            <p className="text-xs text-gray-500">{t('migration.usersCreated')}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{stats.shipments}</p>
            <p className="text-xs text-gray-500">{t('migration.shipmentsCreated')}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{stats.messages}</p>
            <p className="text-xs text-gray-500">{t('migration.messagesCreated')}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.errors}</p>
            <p className="text-xs text-gray-500">{t('migration.errors')}</p>
          </div>
        </div>
      )}

      {/* Log Output */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <h3 className="border-b border-gray-100 px-6 py-3 text-sm font-semibold text-gray-900">
            {t('migration.log')}
          </h3>
          <div ref={logRef} className="max-h-96 overflow-y-auto p-4 font-mono text-xs">
            {logs.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.type === 'error' ? 'text-red-600' :
                  entry.type === 'success' ? 'text-green-600' :
                  entry.type === 'warn' ? 'text-yellow-600' :
                  'text-gray-600'
                }
              >
                {entry.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          <strong>{t('migration.note')}:</strong> {t('migration.noteText')}
        </p>
      </div>
    </div>
  );
}
