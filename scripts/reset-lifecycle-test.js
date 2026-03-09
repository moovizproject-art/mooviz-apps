#!/usr/bin/env node
/**
 * reset-lifecycle-test.js — Clean slate for full lifecycle testing
 *
 * Uses client SDK. Cancels all active deliveries (can't delete via client rules).
 * Sets profile photos on both users.
 *
 * Run: node scripts/reset-lifecycle-test.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const {
  getFirestore, doc, setDoc, updateDoc, getDocs,
  collection, query, where, Timestamp, deleteDoc,
} = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyDpjIi8CHvmQyqareSSVVhHeYVqQvbfza0',
  authDomain: 'mooviz-app-9b766.firebaseapp.com',
  projectId: 'mooviz-app-9b766',
  storageBucket: 'mooviz-app-9b766.firebasestorage.app',
});
const auth = getAuth(app);
const db = getFirestore(app);

const TAMIR_GMAIL_UID = 'OKk1UjHxBObrhqw0ZCarCOv8BC32';
const TAMIR_KAL_UID   = 'hpuyZHKK6agShnHOXAqrgLKg5GA2';

const PHOTOS = {
  [TAMIR_GMAIL_UID]: 'https://randomuser.me/api/portraits/men/32.jpg',
  [TAMIR_KAL_UID]:   'https://randomuser.me/api/portraits/men/75.jpg',
};

async function cancelDeliveriesForUser(uid, role) {
  const field = role === 'sender' ? 'senderId' : 'driverId';
  const snap = await getDocs(query(collection(db, 'deliveries'), where(field, '==', uid)));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    // Cancel active deliveries, skip already terminal
    if (['cancelled', 'completed_paid'].includes(data.status)) continue;
    try {
      await updateDoc(doc(db, 'deliveries', d.id), {
        status: 'cancelled',
        cancelledBy: uid,
        updatedAt: Timestamp.now(),
      });
      console.log(`  [✗] Cancelled: ${d.id} (was ${data.status}) — ${(data.itemDescription || '').substring(0, 40)}`);
      count++;
    } catch (e) {
      console.log(`  [!] Can't cancel ${d.id}: ${e.message}`);
    }
  }
  return count;
}

async function clearChatsForUser(uid) {
  // Find all chats where this user is a participant
  const snap = await getDocs(query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
  ));
  let chatCount = 0;
  let msgCount = 0;
  for (const chatDoc of snap.docs) {
    // Delete all messages in the subcollection first
    const msgSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
    for (const msgDoc of msgSnap.docs) {
      try {
        await deleteDoc(doc(db, 'chats', chatDoc.id, 'messages', msgDoc.id));
        msgCount++;
      } catch (e) {
        console.log(`  [!] Can't delete msg ${msgDoc.id}: ${e.message}`);
      }
    }
    // Delete the chat document itself
    try {
      await deleteDoc(doc(db, 'chats', chatDoc.id));
      chatCount++;
    } catch (e) {
      console.log(`  [!] Can't delete chat ${chatDoc.id}: ${e.message}`);
    }
  }
  console.log(`  [✓] Deleted ${chatCount} chats, ${msgCount} messages`);
}

// ── Quick proof-flow reset mode ──
// Usage: node scripts/reset-lifecycle-test.js --proof-reset
async function proofReset() {
  console.log('=== Resetting demo-del-101 to "waiting" for proof testing ===\n');
  await signInWithEmailAndPassword(auth, 'tamir@kal.solutions', '1q2w3e4r');
  console.log('Signed in.\n');
  await updateDoc(doc(db, 'deliveries', 'demo-del-101'), {
    status: 'waiting',
    proof: {},
    'payment.senderConfirmed': false,
    'payment.driverConfirmed': false,
    updatedAt: Timestamp.now(),
  });
  console.log('[✓] demo-del-101 reset to "waiting" with empty proof\n');
  process.exit(0);
}

if (process.argv.includes('--proof-reset')) {
  proofReset().catch(err => { console.error('[!] Failed:', err.message); process.exit(1); });
} else {
  main().catch(err => { console.error('[!] Failed:', err.message); process.exit(1); });
}

async function main() {
  console.log('=== Reset Lifecycle Test ===\n');

  // ── Sign in as sender (tamir.konor) ──
  console.log('── Step 1: Cancel sender deliveries + clear chats (tamir.konor) ──');
  await signInWithEmailAndPassword(auth, 'tamir.konor@gmail.com', '1q2w3e4r');
  console.log(`  Signed in as tamir.konor@gmail.com`);
  await cancelDeliveriesForUser(TAMIR_GMAIL_UID, 'sender');
  await clearChatsForUser(TAMIR_GMAIL_UID);

  // Set sender photo
  await updateDoc(doc(db, 'users', TAMIR_GMAIL_UID), {
    profilePhotoURL: PHOTOS[TAMIR_GMAIL_UID],
    updatedAt: Timestamp.now(),
  });
  console.log(`  [✓] Photo set for tamir.konor@gmail.com`);
  await signOut(auth);

  // ── Sign in as driver (tamir@kal) ──
  console.log('\n── Step 2: Cancel driver deliveries + clear chats (tamir@kal) ──');
  await signInWithEmailAndPassword(auth, 'tamir@kal.solutions', '1q2w3e4r');
  console.log(`  Signed in as tamir@kal.solutions`);
  await cancelDeliveriesForUser(TAMIR_KAL_UID, 'sender');
  await cancelDeliveriesForUser(TAMIR_KAL_UID, 'driver');
  await clearChatsForUser(TAMIR_KAL_UID);

  // Set driver photo + ensure driver is ready
  await updateDoc(doc(db, 'users', TAMIR_KAL_UID), {
    profilePhotoURL: PHOTOS[TAMIR_KAL_UID],
    driverAvailable: true,
    driverUnlocked: true,
    updatedAt: Timestamp.now(),
  });
  console.log(`  [✓] Photo set for tamir@kal.solutions (driver ready)`);
  await signOut(auth);

  console.log('\n=== Done! ===');
  console.log('  All active deliveries cancelled.');
  console.log('  All chats & messages deleted.');
  console.log('  Profile photos set on both accounts.');
  console.log('  → tamir.konor@gmail.com = SENDER');
  console.log('  → tamir@kal.solutions = DRIVER');
  console.log('  → Create a new delivery as sender, driver will see it\n');
  process.exit(0);
}

// main().catch handled above via argv check
