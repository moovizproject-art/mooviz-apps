#!/usr/bin/env node
/**
 * seed-demo-data.js — Create demo deliveries, chats & ratings
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
  collection,
  Timestamp,
  writeBatch,
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

async function seedAll(tamirUid, kalUid) {
  // ── User Profiles ──
  console.log('\n── Profiles ──');
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
  console.log('\n── Deliveries ──');
  const deliveries = [
    { id:'demo-del-001', senderId:tamirUid, senderName:'Tamir Konortov', status:'pending',
      pickup:{latitude:32.0773,longitude:34.7748,address:'דיזנגוף 50, תל אביב',geohash:'sv8wrg'},
      destination:{latitude:32.7940,longitude:34.9896,address:'שדרות הנשיא 12, חיפה'},
      itemDescription:'מחשב נייד Dell עם מטען', itemSize:'small', suggestedPrice:65,
      notes:'קומה 4, דלת שחורה. להתקשר לפני הגעה' },
    { id:'demo-del-002', senderId:tamirUid, senderName:'Tamir Konortov',
      driverId:kalUid, driverName:'KAL Solutions', driverRating:4.9,
      status:'matched', chatId:'demo-chat-002',
      pickup:{latitude:32.0636,longitude:34.7722,address:'רוטשילד 22, תל אביב',geohash:'sv8wr5'},
      destination:{latitude:31.7850,longitude:35.2272,address:'יפו 100, ירושלים'},
      itemDescription:'שלוש קופסאות ספרים לתרומה', itemSize:'large', suggestedPrice:90,
      notes:'הקופסאות כבדות, צריך עגלה' },
    { id:'demo-del-003', senderId:tamirUid, senderName:'Tamir Konortov',
      driverId:kalUid, driverName:'KAL Solutions', driverRating:4.9,
      status:'picked_up', chatId:'demo-chat-003',
      pickup:{latitude:32.0853,longitude:34.7818,address:'אבן גבירול 30, תל אביב',geohash:'sv8wrg'},
      destination:{latitude:32.3215,longitude:34.8532,address:'הרצל 5, נתניה'},
      itemDescription:'ציוד צילום — מצלמה + חצובה', itemSize:'medium', suggestedPrice:55,
      notes:'פריט שביר! נא לטפל בזהירות' },
    { id:'demo-del-004', senderId:tamirUid, senderName:'Tamir Konortov',
      driverId:kalUid, driverName:'KAL Solutions', driverRating:4.9,
      status:'in_transit', chatId:'demo-chat-004',
      pickup:{latitude:32.1094,longitude:34.8555,address:'סוקולוב 40, רמת השרון',geohash:'sv8xq2'},
      destination:{latitude:32.0167,longitude:34.7500,address:'שד\' ירושלים 15, יפו'},
      itemDescription:'ארגז כלי עבודה + חלקי חילוף', itemSize:'large', suggestedPrice:70, notes:'' },
    { id:'demo-del-005', senderId:tamirUid, senderName:'Tamir Konortov',
      driverId:kalUid, driverName:'KAL Solutions', driverRating:4.9,
      status:'delivered', chatId:'demo-chat-005', rated:false,
      pickup:{latitude:32.0797,longitude:34.7704,address:'בן יהודה 15, תל אביב',geohash:'sv8wrh'},
      destination:{latitude:31.2530,longitude:34.7915,address:'רגר 10, באר שבע'},
      itemDescription:'מתנת יום הולדת — ארגז עץ', itemSize:'medium', suggestedPrice:120,
      notes:'הפתעה! לא לספר למקבל' },
    { id:'demo-del-006', senderId:tamirUid, senderName:'Tamir Konortov',
      driverId:kalUid, driverName:'KAL Solutions', driverRating:4.9,
      status:'delivered', chatId:'demo-chat-006', rated:true,
      pickup:{latitude:32.0636,longitude:34.7722,address:'לילינבלום 4, תל אביב',geohash:'sv8wr5'},
      destination:{latitude:32.4340,longitude:34.9196,address:'פארק הרצליה, הרצליה פיתוח'},
      itemDescription:'שני מסכים 27 אינץ\' Samsung', itemSize:'large', suggestedPrice:150,
      notes:'משלוח דחוף — מסכים חדשים למשרד' },
    { id:'demo-del-007', senderId:tamirUid, senderName:'Tamir Konortov',
      status:'cancelled', cancelledBy:tamirUid,
      pickup:{latitude:32.0853,longitude:34.7818,address:'קפלן 2, תל אביב',geohash:'sv8wrg'},
      destination:{latitude:32.0944,longitude:34.7747,address:'ויצמן 18, תל אביב'},
      itemDescription:'חבילת בגדים', itemSize:'small', suggestedPrice:25,
      notes:'בוטל — מצאתי פתרון אחר' },
    // KAL sends, Tamir drives
    { id:'demo-del-008', senderId:kalUid, senderName:'KAL Solutions',
      status:'pending', interestedDrivers:[tamirUid],
      pickup:{latitude:32.1620,longitude:34.8027,address:'הרצליה פיתוח, בניין אמות',geohash:'sv8yq4'},
      destination:{latitude:32.0853,longitude:34.7818,address:'רוטשילד 1, תל אביב'},
      itemDescription:'Server rack equipment — 2U chassis', itemSize:'large', suggestedPrice:200,
      notes:'Heavy — needs two people. Loading dock at back entrance' },
    { id:'demo-del-009', senderId:kalUid, senderName:'KAL Solutions',
      driverId:tamirUid, driverName:'Tamir Konortov', driverRating:4.7,
      status:'matched', chatId:'demo-chat-009',
      pickup:{latitude:32.1620,longitude:34.8027,address:'Maskit 25, Herzliya Pituach',geohash:'sv8yq4'},
      destination:{latitude:32.0636,longitude:34.7722,address:'Rothschild 45, Tel Aviv'},
      itemDescription:'Marketing materials — banners & flyers', itemSize:'medium', suggestedPrice:45,
      notes:'For the tech conference tomorrow morning' },
    { id:'demo-del-010', senderId:kalUid, senderName:'KAL Solutions',
      driverId:tamirUid, driverName:'Tamir Konortov', driverRating:4.7,
      status:'picked_up', chatId:'demo-chat-010',
      pickup:{latitude:32.1620,longitude:34.8027,address:'אבא אבן 8, הרצליה פיתוח',geohash:'sv8yq4'},
      destination:{latitude:31.7683,longitude:35.2137,address:'גבעת רם, ירושלים'},
      itemDescription:'קופסת דגימות מוצר — 50 יחידות', itemSize:'medium', suggestedPrice:85,
      notes:'לכנס בירושלים, חייב להגיע עד 14:00' },
  ];

  const statusOrder = ['pending','matched','picked_up','in_transit','delivered'];
  for (const d of deliveries) {
    const { id, ...data } = d;
    const statusHistory = {};
    const idx = statusOrder.indexOf(data.status);
    if (data.status === 'cancelled') {
      statusHistory.pending = daysAgo(3); statusHistory.cancelled = daysAgo(2);
    } else {
      for (let i = 0; i <= Math.max(0, idx); i++) statusHistory[statusOrder[i]] = daysAgo(Math.max(0, idx - i));
    }
    await setDoc(doc(db, 'deliveries', id), {
      ...data, photoUrl:'', payment:{senderConfirmed:false,driverConfirmed:false},
      proof:{}, statusHistory, rated:data.rated||false,
      interestedDrivers:data.interestedDrivers||[], scheduledDate:null,
      cancelledBy:data.cancelledBy||null,
      createdAt:daysAgo(idx>=0?idx+1:3), updatedAt:Timestamp.now(),
    });
    console.log(`  [✓] ${id} | ${data.status.padEnd(10)} | ${data.itemDescription.substring(0,40)}`);
  }

  // ── Chats ──
  console.log('\n── Chats ──');
  const chats = [
    { chatId:'demo-chat-002', deliveryId:'demo-del-002', msgs:[
      {s:kalUid,t:'היי, ראיתי את המשלוח שלך. אני יכול לאסוף היום',h:5},
      {s:tamirUid,t:'מעולה! הקופסאות מוכנות בכניסה לבניין',h:4.5},
      {s:kalUid,t:'יש מעלית בבניין? 3 קופסאות זה הרבה לסחוב',h:4},
      {s:tamirUid,t:'כן, מעלית משא. קומה 2',h:3.5},
      {s:kalUid,t:'סבבה, אני בדרך. אגיע בעוד כ-20 דקות',h:3},
    ]},
    { chatId:'demo-chat-003', deliveryId:'demo-del-003', msgs:[
      {s:kalUid,t:'אספתי את ציוד הצילום. הכל ארוז יפה',h:2},
      {s:tamirUid,t:'תודה! תזהר עם החצובה, היא שבירה',h:1.8},
      {s:kalUid,t:'בטח, עטפתי הכל בשמיכה. בדרך לנתניה',h:1.5},
      {s:tamirUid,t:'אלוף! כמה זמן לדעתך?',h:1},
      {s:kalUid,t:'לפי ווייז כ-40 דקות. יש קצת פקקים',h:0.5},
    ]},
    { chatId:'demo-chat-004', deliveryId:'demo-del-004', msgs:[
      {s:kalUid,t:'Hey Tamir, picked up the toolbox. On my way to Jaffa',h:1},
      {s:tamirUid,t:'Great! The recipient is waiting at the entrance',h:0.8},
      {s:kalUid,t:'ETA about 15 minutes. Traffic is light',h:0.3},
    ]},
    { chatId:'demo-chat-005', deliveryId:'demo-del-005', msgs:[
      {s:tamirUid,t:'שלום, המשלוח לבאר שבע — אפשר להגיע היום?',h:48},
      {s:kalUid,t:'כן, ממילא יש לי נסיעה לדרום. מתאים מצוין',h:47},
      {s:tamirUid,t:'מושלם! זו מתנת יום הולדת, אל תגיד למקבל מה בפנים',h:46},
      {s:kalUid,t:'הבנתי, שפתיים חתומות',h:45},
      {s:kalUid,t:'נמסר! הוא נראה מאוד שמח',h:40},
      {s:tamirUid,t:'תודה רבה!! שירות מעולה',h:39},
    ]},
    { chatId:'demo-chat-006', deliveryId:'demo-del-006', msgs:[
      {s:tamirUid,t:'Hi, the monitors are fragile. Please use padding',h:72},
      {s:kalUid,t:'No worries, I have foam padding in the van',h:71},
      {s:tamirUid,t:'Perfect. Herzliya Park, Building 7, 3rd floor',h:70},
      {s:kalUid,t:'Got it. Will be there by 11am. Should I call?',h:69},
      {s:tamirUid,t:'Yes please, ask for Yael at reception',h:68},
      {s:kalUid,t:'Delivered safely! Yael confirmed all good',h:66},
      {s:tamirUid,t:'Amazing service as always. Thank you!',h:65},
    ]},
    { chatId:'demo-chat-009', deliveryId:'demo-del-009', msgs:[
      {s:tamirUid,t:'I can pick up the marketing materials this afternoon',h:3},
      {s:kalUid,t:'Great! Office closes at 18:00. Can you make it?',h:2.5},
      {s:tamirUid,t:'I\'ll be there at 16:30. Parking nearby?',h:2},
      {s:kalUid,t:'Underground parking. Take ticket, I\'ll validate',h:1.5},
    ]},
    { chatId:'demo-chat-010', deliveryId:'demo-del-010', msgs:[
      {s:kalUid,t:'הדגימות מוכנות. 50 יחידות בארגז אחד',h:6},
      {s:tamirUid,t:'מצוין, מגיע בעוד חצי שעה',h:5.5},
      {s:tamirUid,t:'אספתי הכל. יוצא לירושלים עכשיו',h:4},
      {s:kalUid,t:'תודה! הכנס בגבעת רם, אולם 3',h:3.5},
      {s:tamirUid,t:'אני על כביש 1, צפי הגעה עוד שעה',h:2},
    ]},
  ];

  for (const chat of chats) {
    const last = chat.msgs[chat.msgs.length-1];
    await setDoc(doc(db,'chats',chat.chatId), {
      deliveryId:chat.deliveryId, participants:[tamirUid,kalUid],
      lastMessage:last.t, lastMessageAt:hoursAgo(last.h), lastSenderId:last.s,
      createdAt:hoursAgo(chat.msgs[0].h),
    });
    for (const m of chat.msgs) {
      await addDoc(collection(db,'chats',chat.chatId,'messages'), {
        chatId:chat.chatId, senderId:m.s, text:m.t, type:'text', read:true,
        createdAt:hoursAgo(m.h),
      });
    }
    console.log(`  [✓] ${chat.chatId} (${chat.msgs.length} msgs)`);
  }

  // ── Ratings ──
  console.log('\n── Ratings ──');
  await setDoc(doc(db,'ratings','demo-rating-001'), {
    deliveryId:'demo-del-006', fromUserId:tamirUid, toUserId:kalUid,
    rating:5, comment:'Excellent service! Monitors arrived safely.', createdAt:daysAgo(3),
  });
  await setDoc(doc(db,'ratings','demo-rating-002'), {
    deliveryId:'demo-del-006', fromUserId:kalUid, toUserId:tamirUid,
    rating:5, comment:'חבילה מוכנה ומסודרת. שולח אמין ומקצועי.', createdAt:daysAgo(3),
  });
  console.log('  [✓] 2 mutual ratings (5 stars)');
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

  // Write KAL's own profile first (signed in as KAL)
  console.log('── Writing KAL profile (as KAL) ──');
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
  console.log('  10 deliveries (7 Tamir→KAL, 3 KAL→Tamir)');
  console.log('  7 chats (Hebrew + English)');
  console.log('  2 ratings\n');
  process.exit(0);
}

main().catch(err => { console.error('\n[!] Failed:', err.message); process.exit(1); });
