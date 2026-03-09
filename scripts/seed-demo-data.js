#!/usr/bin/env node
/**
 * seed-demo-data.js — Clean & re-seed demo deliveries, chats & ratings
 * between tamir.konor@gmail.com (sender) and info@kal.solutions (driver)
 *
 * Usage:
 *   node scripts/seed-demo-data.js <tamir_password> <kal_password>
 *
 * Uses Firebase Client SDK — no service account needed.
 */

const { initializeApp } = require('firebase/app');
const {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} = require('firebase/auth');
const {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  Timestamp,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyDpjIi8CHvmQyqareSSVVhHeYVqQvbfza0',
  authDomain: 'mooviz-app-9b766.firebaseapp.com',
  projectId: 'mooviz-app-9b766',
  storageBucket: 'mooviz-app-9b766.firebasestorage.app',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── Config ──
const TAMIR_EMAIL = 'tamir.konor@gmail.com';
const KAL_EMAIL = 'info@kal.solutions';

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return Timestamp.fromDate(d);
}
function hoursAgo(n) {
  const d = new Date(); d.setHours(d.getHours() - n);
  return Timestamp.fromDate(d);
}

async function signInUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`  [✓] Signed in: ${email} (${cred.user.uid})`);
    return cred.user.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      console.log(`  [!] ${email}: ${err.code} — trying to create...`);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        console.log(`  [+] Created: ${email} (${cred.user.uid})`);
        return cred.user.uid;
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          console.error(`  [✗] ${email} exists but password is wrong. Please provide correct password.`);
        }
        throw createErr;
      }
    }
    throw err;
  }
}

// ── Clean Collections (only docs belonging to tamirUid / kalUid) ──
async function cleanCollections(tamirUid, kalUid) {
  console.log('\n── Cleaning data for Tamir & KAL only ──');
  const userIds = [tamirUid, kalUid];

  // Delete deliveries where senderId is one of our users
  let delCount = 0;
  for (const uid of userIds) {
    const snap = await getDocs(query(collection(db, 'deliveries'), where('senderId', '==', uid)));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
      delCount++;
    }
  }
  console.log(`  [✓] Deleted ${delCount} deliveries`);

  // Delete chats where participants array contains one of our users
  const seenChats = new Set();
  let chatCount = 0;
  for (const uid of userIds) {
    const snap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', uid)));
    for (const chatDoc of snap.docs) {
      if (seenChats.has(chatDoc.id)) continue; // avoid double-delete
      seenChats.add(chatDoc.id);
      // Delete messages subcollection first
      const msgsSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
      for (const msgDoc of msgsSnap.docs) {
        await deleteDoc(msgDoc.ref);
      }
      if (msgsSnap.size > 0) {
        console.log(`    [·] Deleted ${msgsSnap.size} messages from ${chatDoc.id}`);
      }
      await deleteDoc(chatDoc.ref);
      chatCount++;
    }
  }
  console.log(`  [✓] Deleted ${chatCount} chats`);

  // Delete ratings where fromUserId is one of our users
  let ratCount = 0;
  for (const uid of userIds) {
    const snap = await getDocs(query(collection(db, 'ratings'), where('fromUserId', '==', uid)));
    for (const r of snap.docs) {
      await deleteDoc(r.ref);
      ratCount++;
    }
  }
  console.log(`  [✓] Deleted ${ratCount} ratings`);
}

// ── Seed All Data ──
async function seedAll(tamirUid, kalUid) {
  // ── User Profiles (merge — keep existing) ──
  console.log('\n── Profiles (merge update) ──');
  await setDoc(doc(db, 'users', tamirUid), {
    uid: tamirUid, email: TAMIR_EMAIL, fullName: 'Tamir Konortov',
    phone: '+972501234567', city: 'תל אביב', role: 'sender', activeMode: 'client',
    driverAvailable: false, driverUnlocked: false, kycStatus: 'approved',
    ratingAsSender: { average: 4.7, count: 8 }, ratingAsDriver: { average: 0, count: 0 },
    completedDeliveries: 5, status: 'active', profilePhotoURL: 'https://randomuser.me/api/portraits/men/32.jpg', fcmTokens: [],
    location: { lat: 32.0853, lng: 34.7818, geohash: 'sv8wrg' },
    createdAt: daysAgo(30), updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('  [✓] Tamir Konortov');

  await setDoc(doc(db, 'users', kalUid), {
    uid: kalUid, email: KAL_EMAIL, fullName: 'KAL Solutions',
    phone: '+972521112233', city: 'הרצליה', role: 'driver', activeMode: 'driver',
    driverAvailable: true, driverUnlocked: true, kycStatus: 'approved',
    ratingAsDriver: { average: 4.9, count: 15 }, ratingAsSender: { average: 4.5, count: 3 },
    completedDeliveries: 12, status: 'active', profilePhotoURL: 'https://randomuser.me/api/portraits/men/75.jpg', fcmTokens: [],
    location: { lat: 32.1620, lng: 34.8027, geohash: 'sv8yq4' },
    createdAt: daysAgo(45), updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('  [✓] KAL Solutions');

  // ── Deliveries ──
  console.log('\n── Deliveries (6) ──');

  // #1 — pending, NO driver, brand new listing
  await setDoc(doc(db, 'deliveries', 'demo-del-001'), {
    senderId: tamirUid, senderName: 'Tamir Konortov',
    status: 'pending',
    pickup: { latitude: 32.0773, longitude: 34.7748, address: 'דיזנגוף 50, תל אביב', geohash: 'sv8wrg' },
    destination: { latitude: 32.0636, longitude: 34.7722, address: 'רוטשילד 22, תל אביב', geohash: 'sv8wr5' },
    itemDescription: 'מחשב נייד Dell עם מטען', itemSize: 'small', suggestedPrice: 65,
    notes: 'קומה 4, להתקשר לפני',
    photoUrl: '', interestedDrivers: [], scheduledDate: null,
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {}, rated: false, cancelledBy: null,
    statusHistory: {
      pending: daysAgo(1),
    },
    createdAt: daysAgo(1), updatedAt: Timestamp.now(),
  });
  console.log('  [✓] demo-del-001 | pending    | מחשב נייד Dell עם מטען');

  // #2 — matched, sender=tamir, driver=kal
  await setDoc(doc(db, 'deliveries', 'demo-del-002'), {
    senderId: tamirUid, senderName: 'Tamir Konortov',
    driverId: kalUid, driverName: 'KAL Solutions', driverRating: 4.9,
    status: 'matched', chatId: 'demo-chat-002',
    pickup: { latitude: 32.0853, longitude: 34.7818, address: 'אבן גבירול 30, תל אביב', geohash: 'sv8wrg' },
    destination: { latitude: 32.0655, longitude: 34.7694, address: 'אלנבי 15, תל אביב', geohash: 'sv8wr4' },
    itemDescription: 'קופסת ספרים ישנים', itemSize: 'medium', suggestedPrice: 40,
    notes: '',
    photoUrl: '', interestedDrivers: [kalUid], scheduledDate: null,
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {}, rated: false, cancelledBy: null,
    statusHistory: {
      pending: daysAgo(2),
      matched: daysAgo(1),
    },
    createdAt: daysAgo(2), updatedAt: Timestamp.now(),
  });
  console.log('  [✓] demo-del-002 | matched    | קופסת ספרים ישנים');

  // #3 — matched, sender=kal, driver=tamir (EN)
  await setDoc(doc(db, 'deliveries', 'demo-del-003'), {
    senderId: kalUid, senderName: 'KAL Solutions',
    driverId: tamirUid, driverName: 'Tamir Konortov', driverRating: 4.7,
    status: 'matched', chatId: 'demo-chat-003',
    pickup: { latitude: 32.1620, longitude: 34.8027, address: 'Maskit 25, Herzliya', geohash: 'sv8yq4' },
    destination: { latitude: 32.0630, longitude: 34.7710, address: 'Rothschild 45, Tel Aviv', geohash: 'sv8wr5' },
    itemDescription: 'Marketing banners & flyers', itemSize: 'medium', suggestedPrice: 45,
    notes: 'For the tech conference tomorrow morning',
    photoUrl: '', interestedDrivers: [tamirUid], scheduledDate: null,
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {}, rated: false, cancelledBy: null,
    statusHistory: {
      pending: daysAgo(3),
      matched: daysAgo(2),
    },
    createdAt: daysAgo(3), updatedAt: Timestamp.now(),
  });
  console.log('  [✓] demo-del-003 | matched    | Marketing banners & flyers');

  // #4 — picked_up, sender=tamir, driver=kal
  await setDoc(doc(db, 'deliveries', 'demo-del-004'), {
    senderId: tamirUid, senderName: 'Tamir Konortov',
    driverId: kalUid, driverName: 'KAL Solutions', driverRating: 4.9,
    status: 'picked_up', chatId: 'demo-chat-004',
    pickup: { latitude: 32.1094, longitude: 34.8555, address: 'הברזל 10, תל אביב', geohash: 'sv8xq2' },
    destination: { latitude: 32.0797, longitude: 34.7704, address: 'בן יהודה 80, תל אביב', geohash: 'sv8wrh' },
    itemDescription: 'ציוד משרד — כיסא ארגונומי', itemSize: 'large', suggestedPrice: 95,
    notes: 'כבד — צריך עזרה בפריקה',
    photoUrl: '', interestedDrivers: [kalUid], scheduledDate: null,
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: { pickupURL: 'https://placehold.co/400x300?text=Pickup+Proof' },
    rated: false, cancelledBy: null,
    statusHistory: {
      pending: daysAgo(4),
      matched: daysAgo(3),
      picked_up: hoursAgo(6),
    },
    createdAt: daysAgo(4), updatedAt: Timestamp.now(),
  });
  console.log('  [✓] demo-del-004 | picked_up  | ציוד משרד — כיסא ארגונומי');

  // #5 — delivered, sender=kal, driver=tamir (EN)
  await setDoc(doc(db, 'deliveries', 'demo-del-005'), {
    senderId: kalUid, senderName: 'KAL Solutions',
    driverId: tamirUid, driverName: 'Tamir Konortov', driverRating: 4.7,
    status: 'delivered', chatId: 'demo-chat-005',
    pickup: { latitude: 32.1620, longitude: 34.8027, address: 'Aba Even 12, Herzliya', geohash: 'sv8yq4' },
    destination: { latitude: 32.0636, longitude: 34.7722, address: 'Nachlat Binyamin 30, Tel Aviv', geohash: 'sv8wr5' },
    itemDescription: '3 monitors for office', itemSize: 'large', suggestedPrice: 110,
    notes: 'Handle with care — fragile screens',
    photoUrl: '', interestedDrivers: [tamirUid], scheduledDate: null,
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {
      pickupURL: 'https://placehold.co/400x300?text=Pickup+Proof',
      deliveryURL: 'https://placehold.co/400x300?text=Delivery+Proof',
    },
    rated: false, cancelledBy: null,
    statusHistory: {
      pending: daysAgo(5),
      matched: daysAgo(4),
      picked_up: daysAgo(3),
      delivered: daysAgo(2),
    },
    createdAt: daysAgo(5), updatedAt: Timestamp.now(),
  });
  console.log('  [✓] demo-del-005 | delivered  | 3 monitors for office');

  // #6 — completed_paid, sender=tamir, driver=kal
  await setDoc(doc(db, 'deliveries', 'demo-del-006'), {
    senderId: tamirUid, senderName: 'Tamir Konortov',
    driverId: kalUid, driverName: 'KAL Solutions', driverRating: 4.9,
    status: 'completed_paid', chatId: 'demo-chat-006',
    pickup: { latitude: 32.0730, longitude: 34.7860, address: 'קפלן 7, תל אביב', geohash: 'sv8wrg' },
    destination: { latitude: 32.0780, longitude: 34.7720, address: 'בוגרשוב 40, תל אביב', geohash: 'sv8wrh' },
    itemDescription: 'חבילת בגדים — מתנה', itemSize: 'small', suggestedPrice: 30,
    notes: 'מתנה — לעטוף יפה',
    photoUrl: '', interestedDrivers: [kalUid], scheduledDate: null,
    payment: { senderConfirmed: true, driverConfirmed: true },
    proof: {
      pickupURL: 'https://placehold.co/400x300?text=Pickup+Proof',
      deliveryURL: 'https://placehold.co/400x300?text=Delivery+Proof',
      paymentURL: 'https://placehold.co/400x300?text=Payment+Proof',
    },
    rated: true, cancelledBy: null,
    statusHistory: {
      pending: daysAgo(7),
      matched: daysAgo(6),
      picked_up: daysAgo(5),
      delivered: daysAgo(4),
      completed_paid: daysAgo(3),
    },
    createdAt: daysAgo(7), updatedAt: Timestamp.now(),
  });
  console.log('  [✓] demo-del-006 | completed  | חבילת בגדים — מתנה');

  // ── Chats (4 chats for deliveries #2-#5) ──
  console.log('\n── Chats (4) ──');
  const chats = [
    { chatId: 'demo-chat-002', deliveryId: 'demo-del-002', msgs: [
      { s: kalUid, t: 'היי, ראיתי את המשלוח שלך. אני יכול לאסוף היום אחרי 16:00', h: 8 },
      { s: tamirUid, t: 'מעולה! הספרים ארוזים בקופסה ליד הדלת', h: 7 },
      { s: kalUid, t: 'כמה שוקלת הקופסה בערך?', h: 6.5 },
      { s: tamirUid, t: 'כ-8 קילו. לא כבד מדי', h: 6 },
      { s: kalUid, t: 'סבבה, אגיע ב-16:30. אשלח הודעה כשאני בדרך', h: 5 },
    ]},
    { chatId: 'demo-chat-003', deliveryId: 'demo-del-003', msgs: [
      { s: tamirUid, t: 'Hi, I can pick up the banners this afternoon', h: 10 },
      { s: kalUid, t: 'Great! They\'re at the front desk. Ask for Shira', h: 9 },
      { s: tamirUid, t: 'Will be there around 15:00. Is parking available?', h: 8 },
      { s: kalUid, t: 'Yes, underground parking. Take a ticket and I\'ll validate it', h: 7.5 },
    ]},
    { chatId: 'demo-chat-004', deliveryId: 'demo-del-004', msgs: [
      { s: kalUid, t: 'אספתי את הכיסא. הוא ממש כבד!', h: 5 },
      { s: tamirUid, t: 'כן, זה ארגונומי של הרמן מילר. תיזהר איתו', h: 4.5 },
      { s: kalUid, t: 'עטפתי הכל בניילון בועות. יוצא עכשיו', h: 4 },
      { s: tamirUid, t: 'תודה! המקבל ממתין בכניסה לבניין, קומת קרקע', h: 3.5 },
      { s: kalUid, t: 'אני בדרך, ETA כ-25 דקות לפי ווייז', h: 3 },
    ]},
    { chatId: 'demo-chat-005', deliveryId: 'demo-del-005', msgs: [
      { s: kalUid, t: 'The 3 monitors are packed and ready for pickup', h: 30 },
      { s: tamirUid, t: 'On my way. Do I need a dolly?', h: 29 },
      { s: kalUid, t: 'Yes recommended. They\'re 27-inch screens, quite heavy', h: 28 },
      { s: tamirUid, t: 'Got them all loaded. Heading to Nachlat Binyamin now', h: 26 },
      { s: tamirUid, t: 'Delivered! Recipient confirmed all 3 monitors intact', h: 24 },
    ]},
  ];

  for (const chat of chats) {
    const last = chat.msgs[chat.msgs.length - 1];
    await setDoc(doc(db, 'chats', chat.chatId), {
      deliveryId: chat.deliveryId, participants: [tamirUid, kalUid],
      lastMessage: last.t, lastMessageAt: hoursAgo(last.h), lastSenderId: last.s,
      createdAt: hoursAgo(chat.msgs[0].h),
    });
    for (const m of chat.msgs) {
      await addDoc(collection(db, 'chats', chat.chatId, 'messages'), {
        chatId: chat.chatId, senderId: m.s, text: m.t, type: 'text', read: true,
        createdAt: hoursAgo(m.h),
      });
    }
    console.log(`  [✓] ${chat.chatId} (${chat.msgs.length} msgs)`);
  }

  // No ratings seeded (clean slate)
  console.log('\n── Ratings ──');
  console.log('  [·] None seeded (clean slate)');
}

async function main() {
  console.log('=== MOOVIZ Demo Data Seeder ===\n');

  const tamirPw = process.argv[2];
  const kalPw = process.argv[3];

  if (!tamirPw || !kalPw) {
    console.log('Usage: node seed-demo-data.js <tamir_password> <kal_password>');
    console.log('  Passwords for tamir.konor@gmail.com and info@kal.solutions');
    process.exit(1);
  }

  // Sign in both users to get UIDs
  console.log('── Signing in ──');
  const tamirUid = await signInUser(TAMIR_EMAIL, tamirPw);
  await signOut(auth);
  const kalUid = await signInUser(KAL_EMAIL, kalPw);
  console.log(`\n  Tamir: ${tamirUid}\n  KAL:   ${kalUid}\n`);

  // Clean existing data for these users only (signed in as KAL)
  await cleanCollections(tamirUid, kalUid);

  // Write KAL's own profile first (signed in as KAL)
  console.log('\n── Writing KAL profile (as KAL) ──');
  await setDoc(doc(db, 'users', kalUid), {
    uid: kalUid, email: KAL_EMAIL, fullName: 'KAL Solutions',
    phone: '+972521112233', city: 'הרצליה', role: 'driver', activeMode: 'driver',
    driverAvailable: true, driverUnlocked: true, kycStatus: 'approved',
    ratingAsDriver: { average: 4.9, count: 15 }, ratingAsSender: { average: 4.5, count: 3 },
    completedDeliveries: 12, status: 'active', profilePhotoURL: '', fcmTokens: [],
    location: { lat: 32.1620, lng: 34.8027, geohash: 'sv8yq4' },
    createdAt: daysAgo(45), updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('  [✓] KAL Solutions profile');

  // Switch to Tamir for everything else (Tamir owns most deliveries)
  await signOut(auth);
  await signInUser(TAMIR_EMAIL, tamirPw);

  await seedAll(tamirUid, kalUid);

  console.log('\n=== Done! ===');
  console.log('  6 deliveries (pending, matched x2, picked_up, delivered, completed_paid)');
  console.log('  4 chats with realistic messages');
  console.log('  0 ratings (clean slate)\n');
  process.exit(0);
}

main().catch(err => { console.error('\n[!] Failed:', err.message); process.exit(1); });
