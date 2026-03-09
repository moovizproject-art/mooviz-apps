#!/usr/bin/env node
/**
 * seed-tamir-kal.js — Add demo data for tamir@kal.solutions
 * with cross-deliveries to tamir.konor@gmail.com and info@kal.solutions
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, doc, setDoc, addDoc, collection, Timestamp } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyDpjIi8CHvmQyqareSSVVhHeYVqQvbfza0',
  authDomain: 'mooviz-app-9b766.firebaseapp.com',
  projectId: 'mooviz-app-9b766',
  storageBucket: 'mooviz-app-9b766.firebasestorage.app',
});
const auth = getAuth(app);
const db = getFirestore(app);

const TAMIR_KAL_UID = 'hpuyZHKK6agShnHOXAqrgLKg5GA2';
const TAMIR_GMAIL_UID = 'OKk1UjHxBObrhqw0ZCarCOv8BC32';
const KAL_INFO_UID = 'bBQgRaZ6Zzc8y9cqVsjQuylsDgj1';

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return Timestamp.fromDate(d); }
function hoursAgo(n) { const d = new Date(); d.setHours(d.getHours() - n); return Timestamp.fromDate(d); }

const USER_PHOTOS = {
  [TAMIR_KAL_UID]: 'https://randomuser.me/api/portraits/men/75.jpg',
  [TAMIR_GMAIL_UID]: 'https://randomuser.me/api/portraits/men/32.jpg',
  [KAL_INFO_UID]: 'https://randomuser.me/api/portraits/men/45.jpg',
};

// Sample product/package images from picsum
const SAMPLE_PHOTOS = [
  'https://picsum.photos/seed/pkg1/400/400',
  'https://picsum.photos/seed/pkg2/400/400',
  'https://picsum.photos/seed/pkg3/400/400',
  'https://picsum.photos/seed/pkg4/400/400',
  'https://picsum.photos/seed/pkg5/400/400',
];

async function main() {
  console.log('=== Seeding tamir@kal.solutions demo data ===\n');

  // Sign in as tamir@kal
  const cred = await signInWithEmailAndPassword(auth, 'tamir@kal.solutions', '1q2w3e4r');
  console.log(`Signed in: ${cred.user.uid}\n`);

  // ── Profile ──
  console.log('── Profile ──');
  await setDoc(doc(db, 'users', TAMIR_KAL_UID), {
    uid: TAMIR_KAL_UID, email: 'tamir@kal.solutions', fullName: 'Tamir KAL',
    phone: '+972541234567', city: 'הרצליה', role: 'sender', activeMode: 'client',
    driverAvailable: true, driverUnlocked: true, kycStatus: 'approved',
    ratingAsSender: { average: 4.8, count: 6 }, ratingAsDriver: { average: 4.6, count: 10 },
    completedDeliveries: 8, status: 'active',
    profilePhotoURL: 'https://randomuser.me/api/portraits/men/75.jpg', fcmTokens: [],
    location: { lat: 32.1620, lng: 34.8027, geohash: 'sv8yq4' },
    lastOtpAt: Timestamp.now(),
    createdAt: daysAgo(20), updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('  [✓] Tamir KAL profile');

  // ── Deliveries: tamir@kal sends TO tamir.konor@gmail (driver) ──
  console.log('\n── Deliveries (tamir@kal → tamir.konor) ──');
  const dels1 = [
    { id:'demo-del-101', senderId:TAMIR_KAL_UID, senderName:'Tamir KAL',
      driverId:TAMIR_GMAIL_UID, driverName:'Tamir Konortov', driverRating:4.7,
      status:'matched', chatId:'demo-chat-101',
      pickup:{latitude:32.1620,longitude:34.8027,address:'אבא אבן 12, הרצליה פיתוח',geohash:'sv8yq4'},
      destination:{latitude:32.0636,longitude:34.7722,address:'נחלת בנימין 30, תל אביב'},
      itemDescription:'3 monitors for the new office setup',
      itemSize:'large', suggestedPrice:110, notes:'Fragile! Double-boxed' },
    { id:'demo-del-102', senderId:TAMIR_KAL_UID, senderName:'Tamir KAL',
      driverId:TAMIR_GMAIL_UID, driverName:'Tamir Konortov', driverRating:4.7,
      status:'picked_up', chatId:'demo-chat-102',
      pickup:{latitude:32.1620,longitude:34.8027,address:'מסכית 7, הרצליה פיתוח',geohash:'sv8yq4'},
      destination:{latitude:31.7683,longitude:35.2137,address:'שד\' הרצל 1, ירושלים'},
      itemDescription:'ציוד למשרד — כיסא ארגונומי',
      itemSize:'large', suggestedPrice:95, notes:'כיסא מפורק, 2 קרטונים' },
    { id:'demo-del-103', senderId:TAMIR_KAL_UID, senderName:'Tamir KAL',
      status:'pending',
      pickup:{latitude:32.1620,longitude:34.8027,address:'דרך השלום 2, הרצליה',geohash:'sv8yq4'},
      destination:{latitude:32.0853,longitude:34.7818,address:'דיזנגוף סנטר, תל אביב'},
      itemDescription:'קופסת גאדג\'טים לאירוע השקה',
      itemSize:'medium', suggestedPrice:50, notes:'אירוע ב-18:00, חייב להגיע עד 16:00' },
  ];

  // ── Deliveries: tamir@kal sends TO info@kal (driver) ──
  console.log('── Deliveries (tamir@kal → info@kal) ──');
  const dels2 = [
    { id:'demo-del-104', senderId:TAMIR_KAL_UID, senderName:'Tamir KAL',
      driverId:KAL_INFO_UID, driverName:'KAL Solutions', driverRating:4.9,
      status:'in_transit', chatId:'demo-chat-104',
      pickup:{latitude:32.1620,longitude:34.8027,address:'הרצליה פיתוח, בניין סאפיינס',geohash:'sv8yq4'},
      destination:{latitude:32.7940,longitude:34.9896,address:'מרכז חורב, חיפה'},
      itemDescription:'חומרי שיווק — רולאפים ופליירים',
      itemSize:'large', suggestedPrice:130, notes:'לכנס טכנולוגי מחר בבוקר' },
    { id:'demo-del-105', senderId:TAMIR_KAL_UID, senderName:'Tamir KAL',
      driverId:KAL_INFO_UID, driverName:'KAL Solutions', driverRating:4.9,
      status:'delivered', chatId:'demo-chat-105', rated:true,
      pickup:{latitude:32.1620,longitude:34.8027,address:'שד\' רוטשילד 1, הרצליה',geohash:'sv8yq4'},
      destination:{latitude:31.2530,longitude:34.7915,address:'פארק הייטק, באר שבע'},
      itemDescription:'סרבר Dell PowerEdge R740',
      itemSize:'large', suggestedPrice:250, notes:'Heavy! 25kg. Loading dock access needed' },
  ];

  // ── Deliveries: info@kal sends, tamir@kal drives ──
  console.log('── Deliveries (info@kal → tamir@kal as driver) ──');
  const dels3 = [
    { id:'demo-del-106', senderId:KAL_INFO_UID, senderName:'KAL Solutions',
      driverId:TAMIR_KAL_UID, driverName:'Tamir KAL', driverRating:4.6,
      status:'picked_up', chatId:'demo-chat-106',
      pickup:{latitude:32.0853,longitude:34.7818,address:'לינקולן 20, תל אביב',geohash:'sv8wrg'},
      destination:{latitude:32.1094,longitude:34.8555,address:'כפר סבא, רחוב ויצמן'},
      itemDescription:'Network switches — Cisco Catalyst 9300',
      itemSize:'medium', suggestedPrice:75, notes:'Handle with care, anti-static packaging' },
    { id:'demo-del-107', senderId:KAL_INFO_UID, senderName:'KAL Solutions',
      driverId:TAMIR_KAL_UID, driverName:'Tamir KAL', driverRating:4.6,
      status:'delivered', chatId:'demo-chat-107', rated:false,
      pickup:{latitude:32.0636,longitude:34.7722,address:'אלנבי 100, תל אביב',geohash:'sv8wr5'},
      destination:{latitude:32.3215,longitude:34.8532,address:'נתניה, רחוב הרצל'},
      itemDescription:'דגימות קפה מיוחדות + ספלים ממותגים',
      itemSize:'small', suggestedPrice:40, notes:'מתנות ללקוחות VIP' },
  ];

  // ── tamir.konor sends, tamir@kal drives ──
  console.log('── Deliveries (tamir.konor → tamir@kal as driver) ──');
  const dels4 = [
    { id:'demo-del-108', senderId:TAMIR_GMAIL_UID, senderName:'Tamir Konortov',
      driverId:TAMIR_KAL_UID, driverName:'Tamir KAL', driverRating:4.6,
      status:'matched', chatId:'demo-chat-108',
      pickup:{latitude:32.0797,longitude:34.7704,address:'בן יהודה 50, תל אביב',geohash:'sv8wrh'},
      destination:{latitude:32.1620,longitude:34.8027,address:'הרצליה פיתוח, בניין אלביט'},
      itemDescription:'Prototype hardware — custom PCB boards',
      itemSize:'small', suggestedPrice:80, notes:'Extremely fragile electronics. Keep dry.' },
  ];

  const allDels = [...dels1, ...dels2, ...dels3, ...dels4];
  const statusOrder = ['pending','matched','picked_up','in_transit','delivered'];

  for (const d of allDels) {
    const { id, ...data } = d;
    const statusHistory = {};
    const idx = statusOrder.indexOf(data.status);
    if (data.status === 'cancelled') {
      statusHistory.pending = daysAgo(3); statusHistory.cancelled = daysAgo(2);
    } else {
      for (let i = 0; i <= Math.max(0, idx); i++) statusHistory[statusOrder[i]] = daysAgo(Math.max(0, idx - i));
    }
    await setDoc(doc(db, 'deliveries', id), {
      ...data, photoUrl:SAMPLE_PHOTOS[0], mediaURLs:SAMPLE_PHOTOS,
      senderPhotoUrl: USER_PHOTOS[data.senderId] || '',
      driverPhotoUrl: data.driverId ? (USER_PHOTOS[data.driverId] || '') : '',
      payment:{senderConfirmed:false,driverConfirmed:false},
      proof:{}, statusHistory, rated:data.rated||false,
      interestedDrivers:data.interestedDrivers||[], scheduledDate:null,
      cancelledBy:data.cancelledBy||null,
      createdAt:daysAgo(idx>=0?idx+1:3), updatedAt:Timestamp.now(),
    });
    console.log(`  [✓] ${id} | ${data.status.padEnd(10)} | ${data.itemDescription.substring(0,45)}`);
  }

  // ── Chats ──
  console.log('\n── Chats ──');
  const chats = [
    { chatId:'demo-chat-101', deliveryId:'demo-del-101', msgs:[
      {s:TAMIR_KAL_UID,t:'Hey Tamir, can you pick up 3 monitors from our office?',h:8},
      {s:TAMIR_GMAIL_UID,t:'Sure! What time works best?',h:7.5},
      {s:TAMIR_KAL_UID,t:'Anytime after 14:00. Ask for reception desk',h:7},
      {s:TAMIR_GMAIL_UID,t:'Perfect, I\'ll be there around 15:00',h:6},
    ]},
    { chatId:'demo-chat-102', deliveryId:'demo-del-102', msgs:[
      {s:TAMIR_KAL_UID,t:'הכיסא מפורק ב-2 קרטונים. מוכן לאיסוף',h:4},
      {s:TAMIR_GMAIL_UID,t:'אספתי! יוצא לירושלים עכשיו',h:3},
      {s:TAMIR_KAL_UID,t:'מעולה, שם מחכה לך דוד בקומה 5',h:2.5},
    ]},
    { chatId:'demo-chat-104', deliveryId:'demo-del-104', msgs:[
      {s:TAMIR_KAL_UID,t:'הרולאפים מוכנים, יש 4 יחידות + קרטון פליירים',h:3},
      {s:KAL_INFO_UID,t:'מצוין, אני בדרך מתל אביב. ETA שעה',h:2.5},
      {s:TAMIR_KAL_UID,t:'סבבה, הם בלובי של הבניין',h:2},
      {s:KAL_INFO_UID,t:'אספתי הכל, בדרך לחיפה',h:1},
    ]},
    { chatId:'demo-chat-105', deliveryId:'demo-del-105', msgs:[
      {s:TAMIR_KAL_UID,t:'The server weighs 25kg, loading dock at Building C',h:72},
      {s:KAL_INFO_UID,t:'Got it. I have a dolly. Be there at 10am',h:71},
      {s:KAL_INFO_UID,t:'Picked up. Heading to Beer Sheva now',h:68},
      {s:TAMIR_KAL_UID,t:'Great. Contact person: Moshe, +972-50-555-1234',h:67},
      {s:KAL_INFO_UID,t:'Delivered! Moshe confirmed receipt. All good.',h:62},
      {s:TAMIR_KAL_UID,t:'Perfect, thanks for the great service!',h:61},
    ]},
    { chatId:'demo-chat-106', deliveryId:'demo-del-106', msgs:[
      {s:KAL_INFO_UID,t:'הסוויצ\'ים ארוזים באנטי-סטטי. 2 קופסאות',h:5},
      {s:TAMIR_KAL_UID,t:'מגיע בעוד 20 דקות. יש חניה?',h:4.5},
      {s:KAL_INFO_UID,t:'כן, חניון תת-קרקעי. תיקח כרטיס',h:4},
      {s:TAMIR_KAL_UID,t:'אספתי! בדרך לכפר סבא',h:3},
    ]},
    { chatId:'demo-chat-107', deliveryId:'demo-del-107', msgs:[
      {s:KAL_INFO_UID,t:'הדגימות מוכנות — 20 שקיות קפה + 10 ספלים',h:24},
      {s:TAMIR_KAL_UID,t:'מגניב! אני אעבור אחרי הצהריים',h:23},
      {s:TAMIR_KAL_UID,t:'אספתי, הכל שלם',h:20},
      {s:KAL_INFO_UID,t:'תודה! הלקוח בנתניה — רחוב הרצל 15, קומה 2',h:19},
      {s:TAMIR_KAL_UID,t:'נמסר בהצלחה! הלקוח היה מאוד שמח',h:16},
    ]},
    { chatId:'demo-chat-108', deliveryId:'demo-del-108', msgs:[
      {s:TAMIR_GMAIL_UID,t:'Hi, the PCB boards are in anti-static bags. Very fragile!',h:6},
      {s:TAMIR_KAL_UID,t:'Understood. I\'ll bring foam padding. What floor?',h:5.5},
      {s:TAMIR_GMAIL_UID,t:'Ground floor lobby. Ask security for the package from Tamir K.',h:5},
    ]},
  ];

  for (const chat of chats) {
    const last = chat.msgs[chat.msgs.length-1];
    const participants = [...new Set(chat.msgs.map(m => m.s))];
    // Ensure both parties are in participants
    await setDoc(doc(db, 'chats', chat.chatId), {
      deliveryId: chat.deliveryId,
      participants: participants.length >= 2 ? participants : [TAMIR_KAL_UID, participants[0]],
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

  // ── Ratings ──
  console.log('\n── Ratings ──');
  await setDoc(doc(db, 'ratings', 'demo-rating-105a'), {
    deliveryId:'demo-del-105', fromUserId:TAMIR_KAL_UID, toUserId:KAL_INFO_UID,
    rating:5, comment:'Professional delivery of heavy server. Highly recommend!',
    createdAt:daysAgo(2),
  });
  await setDoc(doc(db, 'ratings', 'demo-rating-105b'), {
    deliveryId:'demo-del-105', fromUserId:KAL_INFO_UID, toUserId:TAMIR_KAL_UID,
    rating:5, comment:'ציוד היה ארוז מצוין. שולח אמין.',
    createdAt:daysAgo(2),
  });
  console.log('  [✓] 2 mutual ratings (5 stars)');

  console.log('\n=== Done! ===');
  console.log('  8 new deliveries across all 3 users');
  console.log('  7 new chat conversations');
  console.log('  2 new ratings\n');
  process.exit(0);
}

main().catch(err => { console.error('\n[!] Failed:', err.message); process.exit(1); });
