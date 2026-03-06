#!/usr/bin/env node
/**
 * seed-test-data.js — Create test users and deliveries in Firebase
 *
 * Usage:
 *   node scripts/seed-test-data.js
 *
 * Requires: .env file or environment variables with Firebase config
 *   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
 *   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
 */

const { initializeApp } = require('firebase/app');
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require('firebase/auth');
const {
  getFirestore,
  doc,
  setDoc,
  collection,
  Timestamp,
} = require('firebase/firestore');

// ── Firebase config ──
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBvnU6XkzYzRzOzL1hN9dFrQzTxMvLvV8I',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'mooviz-app-9b766.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'mooviz-app-9b766',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'mooviz-app-9b766.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
};

const app = initializeApp(firebaseConfig);
const authInstance = getAuth(app);
const db = getFirestore(app);

// ── Test Data ──

const TEST_USERS = [
  {
    email: 'sender1@test.mooviz.co.il',
    password: 'Test123!',
    profile: {
      fullName: 'דני כהן',
      phone: '+972501234567',
      city: 'תל אביב',
      role: 'sender',
      activeMode: 'sender',
      kycStatus: 'approved',
      rating: { average: 4.5, count: 12 },
      completedDeliveries: 8,
      status: 'active',
      profilePhotoURL: '',
    },
  },
  {
    email: 'sender2@test.mooviz.co.il',
    password: 'Test123!',
    profile: {
      fullName: 'מיכל לוי',
      phone: '+972521234567',
      city: 'חיפה',
      role: 'sender',
      activeMode: 'sender',
      kycStatus: 'approved',
      rating: { average: 4.8, count: 5 },
      completedDeliveries: 3,
      status: 'active',
      profilePhotoURL: '',
    },
  },
  {
    email: 'driver1@test.mooviz.co.il',
    password: 'Test123!',
    profile: {
      fullName: 'יוסי אברהם',
      phone: '+972531234567',
      city: 'תל אביב',
      role: 'driver',
      activeMode: 'driver',
      kycStatus: 'approved',
      rating: { average: 4.7, count: 20 },
      completedDeliveries: 15,
      status: 'active',
      profilePhotoURL: '',
      location: { lat: 32.0853, lng: 34.7818, geohash: 'sv8wrg' },
    },
  },
  {
    email: 'driver2@test.mooviz.co.il',
    password: 'Test123!',
    profile: {
      fullName: 'רון שמעוני',
      phone: '+972541234567',
      city: 'ירושלים',
      role: 'driver',
      activeMode: 'driver',
      kycStatus: 'approved',
      rating: { average: 4.2, count: 8 },
      completedDeliveries: 6,
      status: 'active',
      profilePhotoURL: '',
      location: { lat: 31.7683, lng: 35.2137, geohash: 'svk4p7' },
    },
  },
];

async function createOrSignIn(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(authInstance, email, password);
    console.log(`  [+] Created user: ${email} (${cred.user.uid})`);
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(authInstance, email, password);
      console.log(`  [=] User exists: ${email} (${cred.user.uid})`);
      return cred.user;
    }
    throw err;
  }
}

async function seedUsers() {
  console.log('\n── Seeding Users ──');
  const uids = {};

  for (const user of TEST_USERS) {
    const fbUser = await createOrSignIn(user.email, user.password);
    uids[user.email] = fbUser.uid;

    await setDoc(doc(db, 'users', fbUser.uid), {
      uid: fbUser.uid,
      email: user.email,
      ...user.profile,
      fcmToken: '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    console.log(`  [✓] Profile saved: ${user.profile.fullName}`);
  }

  return uids;
}

async function seedDeliveries(uids) {
  console.log('\n── Seeding Deliveries ──');

  const sender1 = uids['sender1@test.mooviz.co.il'];
  const sender2 = uids['sender2@test.mooviz.co.il'];
  const driver1 = uids['driver1@test.mooviz.co.il'];
  const driver2 = uids['driver2@test.mooviz.co.il'];

  const deliveries = [
    {
      id: 'test-delivery-001',
      senderId: sender1,
      senderName: 'דני כהן',
      status: 'new',
      pickup: { address: 'דיזנגוף 50, תל אביב', lat: 32.0773, lng: 34.7748, geohash: 'sv8wrg' },
      destination: { address: 'הרצל 10, חיפה', lat: 32.7940, lng: 34.9896, geohash: 'sv9n4j' },
      itemDescription: 'קופסת ספרים (5 ספרים)',
      itemSize: 'medium',
      suggestedPrice: 45,
      notes: 'קומה 3, קוד כניסה 1234',
    },
    {
      id: 'test-delivery-002',
      senderId: sender1,
      senderName: 'דני כהן',
      driverId: driver1,
      driverName: 'יוסי אברהם',
      status: 'matched',
      pickup: { address: 'רוטשילד 1, תל אביב', lat: 32.0636, lng: 34.7722, geohash: 'sv8wr5' },
      destination: { address: 'יפו 100, ירושלים', lat: 31.7850, lng: 35.2272, geohash: 'svk4p9' },
      itemDescription: 'מעטפה עם מסמכים',
      itemSize: 'small',
      suggestedPrice: 30,
      notes: '',
    },
    {
      id: 'test-delivery-003',
      senderId: sender2,
      senderName: 'מיכל לוי',
      driverId: driver1,
      driverName: 'יוסי אברהם',
      status: 'picked_up',
      pickup: { address: 'שדרות הנשיא 45, חיפה', lat: 32.8021, lng: 34.9872, geohash: 'sv9n4h' },
      destination: { address: 'אלנבי 20, תל אביב', lat: 32.0666, lng: 34.7693, geohash: 'sv8wr3' },
      itemDescription: 'כיסא משרדי',
      itemSize: 'large',
      suggestedPrice: 80,
      notes: 'פריט שביר, יש לטפל בזהירות',
    },
    {
      id: 'test-delivery-004',
      senderId: sender1,
      senderName: 'דני כהן',
      driverId: driver2,
      driverName: 'רון שמעוני',
      status: 'delivered',
      pickup: { address: 'בן יהודה 15, תל אביב', lat: 32.0797, lng: 34.7704, geohash: 'sv8wrh' },
      destination: { address: 'מלכי ישראל 30, ירושלים', lat: 31.7890, lng: 35.2140, geohash: 'svk4p8' },
      itemDescription: 'חבילת בגדים',
      itemSize: 'medium',
      suggestedPrice: 55,
      notes: '',
    },
    {
      id: 'test-delivery-005',
      senderId: sender2,
      senderName: 'מיכל לוי',
      status: 'cancelled',
      pickup: { address: 'הרצליה פיתוח, הרצליה', lat: 32.1620, lng: 34.8027, geohash: 'sv8yq4' },
      destination: { address: 'נתניה מרכז, נתניה', lat: 32.3215, lng: 34.8532, geohash: 'svb16k' },
      itemDescription: 'ציוד אלקטרוניקה',
      itemSize: 'small',
      suggestedPrice: 35,
      notes: 'בוטל על ידי השולח',
      cancelledBy: sender2,
    },
  ];

  for (const d of deliveries) {
    const { id, ...data } = d;
    await setDoc(doc(db, 'deliveries', id), {
      ...data,
      photoUrl: '',
      payment: { senderConfirmed: false, driverConfirmed: false },
      proof: {},
      statusHistory: [{ status: data.status, at: Timestamp.now() }],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`  [✓] Delivery: ${id} (${data.status}) — ${data.itemDescription}`);
  }
}

async function seedRatings(uids) {
  console.log('\n── Seeding Ratings ──');

  const sender1 = uids['sender1@test.mooviz.co.il'];
  const driver2 = uids['driver2@test.mooviz.co.il'];

  const ratings = [
    {
      id: 'test-rating-001',
      deliveryId: 'test-delivery-004',
      fromUserId: sender1,
      toUserId: driver2,
      rating: 5,
      comment: 'נהג מצוין, הגיע בזמן!',
      createdAt: Timestamp.now(),
    },
    {
      id: 'test-rating-002',
      deliveryId: 'test-delivery-004',
      fromUserId: driver2,
      toUserId: sender1,
      rating: 4,
      comment: 'שולח אמין, חבילה הייתה מוכנה',
      createdAt: Timestamp.now(),
    },
  ];

  for (const r of ratings) {
    const { id, ...data } = r;
    await setDoc(doc(db, 'ratings', id), data);
    console.log(`  [✓] Rating: ${id} — ${data.rating} stars`);
  }
}

async function main() {
  console.log('=== MOOVIZ Test Data Seeder ===');
  console.log(`Project: ${firebaseConfig.projectId}`);

  try {
    const uids = await seedUsers();
    await seedDeliveries(uids);
    await seedRatings(uids);
    console.log('\n=== Done! All test data seeded. ===\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[!] Seeding failed:', err.message || err);
    process.exit(1);
  }
}

main();
