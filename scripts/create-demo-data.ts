/**
 * create-demo-data.ts — Create demo drivers, senders, and deliveries for testing
 * Run: cd functions && npx ts-node --project tsconfig.json ../scripts/create-demo-data.ts
 */
import * as admin from "firebase-admin";

admin.initializeApp({ projectId: "mooviz-app-9b766" });
const db = admin.firestore();
const auth = admin.auth();

const now = admin.firestore.Timestamp.now();

// ─── Demo Users ───────────────────────────────────────────────

const DEMO_SENDERS = [
  {
    email: "sender1@demo.mooviz.co.il",
    password: "Demo1234!",
    fullName: "אבי כהן",
    nickname: "אבי",
    phone: "+972501111111",
    city: "תל אביב",
    role: "sender",
    gender: "male",
    ageRange: "35-44",
  },
  {
    email: "sender2@demo.mooviz.co.il",
    password: "Demo1234!",
    fullName: "רונית לוי",
    nickname: "רונית",
    phone: "+972502222222",
    city: "חיפה",
    role: "sender",
    gender: "female",
    ageRange: "25-34",
  },
];

const DEMO_DRIVERS = [
  {
    email: "driver1@demo.mooviz.co.il",
    password: "Demo1234!",
    fullName: "משה ישראלי",
    nickname: "משה",
    phone: "+972503333333",
    city: "תל אביב",
    ratingAsDriver: { average: 4.8, count: 42 },
    completedDeliveries: 42,
    location: { lat: 32.0853, lng: 34.7818, geohash: "sv8wrg" },
  },
  {
    email: "driver2@demo.mooviz.co.il",
    password: "Demo1234!",
    fullName: "דני אלון",
    nickname: "דני",
    phone: "+972504444444",
    city: "רמת גן",
    ratingAsDriver: { average: 4.5, count: 18 },
    completedDeliveries: 18,
    location: { lat: 32.0680, lng: 34.8244, geohash: "sv8wxy" },
  },
  {
    email: "driver3@demo.mooviz.co.il",
    password: "Demo1234!",
    fullName: "יעל אברהם",
    nickname: "יעל",
    phone: "+972505555555",
    city: "הרצליה",
    ratingAsDriver: { average: 4.9, count: 87 },
    completedDeliveries: 87,
    location: { lat: 32.1629, lng: 34.7914, geohash: "sv8x5g" },
  },
  {
    email: "driver4@demo.mooviz.co.il",
    password: "Demo1234!",
    fullName: "עומר שפירא",
    nickname: "עומר",
    phone: "+972506666666",
    city: "ראשון לציון",
    ratingAsDriver: { average: 3.9, count: 7 },
    completedDeliveries: 7,
    location: { lat: 31.9642, lng: 34.8048, geohash: "sv8qqm" },
  },
];

async function createOrGetUser(email: string, password: string, displayName: string): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  User exists: ${email} → ${existing.uid}`);
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email, password, displayName, emailVerified: true });
    console.log(`  Created user: ${email} → ${created.uid}`);
    return created.uid;
  }
}

async function createDemoUsers() {
  console.log("\n═══ Creating Demo Senders ═══");
  const senderUids: string[] = [];
  for (const sender of DEMO_SENDERS) {
    const uid = await createOrGetUser(sender.email, sender.password, sender.fullName);
    senderUids.push(uid);
    await db.collection("users").doc(uid).set({
      uid,
      fullName: sender.fullName,
      nickname: sender.nickname,
      phone: sender.phone,
      email: sender.email,
      city: sender.city,
      role: sender.role,
      gender: sender.gender,
      ageRange: sender.ageRange,
      status: "active",
      ratingAsSender: { average: 4.6, count: 12 },
      completedDeliveries: 5,
      fcmTokens: [],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    console.log(`  Firestore profile set for ${sender.fullName}`);
  }

  console.log("\n═══ Creating Demo Drivers ═══");
  const driverUids: string[] = [];
  for (const driver of DEMO_DRIVERS) {
    const uid = await createOrGetUser(driver.email, driver.password, driver.fullName);
    driverUids.push(uid);
    await db.collection("users").doc(uid).set({
      uid,
      fullName: driver.fullName,
      nickname: driver.nickname,
      phone: driver.phone,
      email: driver.email,
      city: driver.city,
      role: "sender", // all users register as sender
      driverUnlocked: true,
      kycStatus: "approved",
      status: "active",
      gender: "male",
      ageRange: "25-34",
      ratingAsSender: { average: 4.2, count: 5 },
      ratingAsDriver: driver.ratingAsDriver,
      completedDeliveries: driver.completedDeliveries,
      location: driver.location,
      driverAvailable: true,
      driverPrefs: {
        homeAddress: { address: driver.city, lat: driver.location.lat, lng: driver.location.lng, geohash: driver.location.geohash },
        workAddress: null,
        radiusKm: 20,
        vehicleType: "car",
        deliverySizes: ["small", "medium", "large"],
        schedule: { sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: false, saturday: false },
      },
      fcmTokens: [],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    console.log(`  Firestore profile set for ${driver.fullName} (driver)`);
  }

  return { senderUids, driverUids };
}

// ─── Demo Deliveries ──────────────────────────────────────────

async function createDemoDeliveries(senderUids: string[], driverUids: string[]) {
  console.log("\n═══ Creating Demo Deliveries ═══");

  const sender1 = senderUids[0];
  const sender2 = senderUids[1];
  const driver1 = driverUids[0];
  const driver2 = driverUids[1];
  const driver3 = driverUids[2];
  const driver4 = driverUids[3];

  // 1. NEW delivery with 3 interested drivers (for testing multi-driver selection)
  const d1Ref = db.collection("deliveries").doc();
  await d1Ref.set({
    senderId: sender1,
    senderName: "אבי",
    senderPhotoUrl: null,
    senderRating: 4.6,
    driverId: null,
    status: "new",
    pickup: { address: "רחוב דיזנגוף 50, תל אביב", city: "תל אביב", lat: 32.0775, lng: 34.7748, geohash: "sv8wrb" },
    destination: { address: "רחוב הרצל 10, חיפה", city: "חיפה", lat: 32.7940, lng: 34.9896, geohash: "svd0p5" },
    item: { description: "ארגז ספרים", type: "general", size: "medium", photoURL: "" },
    price: 120,
    pickupDate: "asap",
    timeRange: null,
    notes: "קומה 3, יש מעלית",
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {},
    statusHistory: [{ status: "new", timestamp: now, actor: sender1, note: "Delivery created" }],
    interestedDrivers: [
      { uid: driver1, name: "משה ישראלי", photoUrl: null, rating: 4.8, completedDeliveries: 42, distanceKm: 1.2, expressedAt: now, status: "interested" },
      { uid: driver2, name: "דני אלון", photoUrl: null, rating: 4.5, completedDeliveries: 18, distanceKm: 5.1, expressedAt: now, status: "interested" },
      { uid: driver3, name: "יעל אברהם", photoUrl: null, rating: 4.9, completedDeliveries: 87, distanceKm: 8.0, expressedAt: now, status: "interested" },
    ],
    selectedDriverId: null,
    selectionExpiresAt: null,
    timeoutAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 72 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  ✅ Delivery 1 (NEW, 3 interested drivers): ${d1Ref.id}`);

  // 2. NEW delivery with no interest yet (for testing express interest)
  const d2Ref = db.collection("deliveries").doc();
  const tomorrow = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);
  await d2Ref.set({
    senderId: sender1,
    senderName: "אבי",
    senderPhotoUrl: null,
    senderRating: 4.6,
    driverId: null,
    status: "new",
    pickup: { address: "רחוב אלנבי 100, תל אביב", city: "תל אביב", lat: 32.0636, lng: 34.7691, geohash: "sv8wqn" },
    destination: { address: "רחוב ויצמן 30, כפר סבא", city: "כפר סבא", lat: 32.1780, lng: 34.9076, geohash: "sv8xkm" },
    item: { description: "מחשב נייד + מטען", type: "electronics", size: "small", photoURL: "" },
    price: 80,
    pickupDate: tomorrow.toDate().toISOString(),
    timeRange: "morning",
    notes: "",
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {},
    statusHistory: [{ status: "new", timestamp: now, actor: sender1, note: "Delivery created" }],
    interestedDrivers: [],
    selectedDriverId: null,
    selectionExpiresAt: null,
    timeoutAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 72 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  ✅ Delivery 2 (NEW, no interest, scheduled tomorrow morning): ${d2Ref.id}`);

  // 3. COMPLETED_PAID delivery with ratings (for testing rating display)
  const d3Ref = db.collection("deliveries").doc();
  const threeDaysAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 3 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 2 * 24 * 60 * 60 * 1000);
  await d3Ref.set({
    senderId: sender1,
    senderName: "אבי",
    senderPhotoUrl: null,
    senderRating: 4.6,
    driverId: driver1,
    driverName: "משה ישראלי",
    driverPhotoUrl: null,
    driverRating: 4.8,
    status: "completed_paid",
    pickup: { address: "רחוב בן יהודה 20, תל אביב", city: "תל אביב", lat: 32.0808, lng: 34.7705, geohash: "sv8wrc" },
    destination: { address: "רחוב רוטשילד 5, ראשון לציון", city: "ראשון לציון", lat: 31.9730, lng: 34.7925, geohash: "sv8qqr" },
    item: { description: "שולחן כתיבה מפורק", type: "furniture", size: "large", photoURL: "" },
    price: 200,
    pickupDate: "asap",
    notes: "זהיר עם הזכוכית",
    payment: { senderConfirmed: true, driverConfirmed: true },
    proof: {},
    statusHistory: [
      { status: "new", timestamp: threeDaysAgo, actor: sender1 },
      { status: "waiting", timestamp: threeDaysAgo, actor: driver1 },
      { status: "picked_up", timestamp: twoDaysAgo, actor: driver1 },
      { status: "delivered", timestamp: twoDaysAgo, actor: driver1 },
      { status: "completed_paid", timestamp: twoDaysAgo, actor: "system" },
    ],
    ratedBySender: true,
    ratedByDriver: true,
    senderRatingGiven: { rating: 5, comment: "נהג מצוין! הגיע בזמן והיה מאוד זהיר עם הרהיט" },
    driverRatingGiven: { rating: 4, comment: "שולח נחמד, הכל היה מוכן" },
    ratingsVisibleAt: twoDaysAgo,
    interestedDrivers: [
      { uid: driver1, name: "משה ישראלי", photoUrl: null, rating: 4.8, completedDeliveries: 42, distanceKm: 1.2, expressedAt: threeDaysAgo, status: "confirmed" },
    ],
    timeoutAt: threeDaysAgo,
    createdAt: threeDaysAgo,
    updatedAt: twoDaysAgo,
  });
  console.log(`  ✅ Delivery 3 (COMPLETED_PAID, with ratings): ${d3Ref.id}`);

  // Create rating documents for delivery 3
  await db.collection("ratings").add({
    deliveryId: d3Ref.id,
    fromUserId: sender1,
    targetUserId: driver1,
    rating: 5,
    comment: "נהג מצוין! הגיע בזמן והיה מאוד זהיר עם הרהיט",
    role: "sender",
    createdAt: twoDaysAgo,
  });
  await db.collection("ratings").add({
    deliveryId: d3Ref.id,
    fromUserId: driver1,
    targetUserId: sender1,
    rating: 4,
    comment: "שולח נחמד, הכל היה מוכן",
    role: "driver",
    createdAt: twoDaysAgo,
  });
  console.log(`  ✅ Ratings created for delivery 3`);

  // 4. COMPLETED_PAID delivery from sender2 (for expenses test)
  const d4Ref = db.collection("deliveries").doc();
  const weekAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);
  await d4Ref.set({
    senderId: sender2,
    senderName: "רונית",
    senderPhotoUrl: null,
    senderRating: 4.3,
    driverId: driver2,
    driverName: "דני אלון",
    driverPhotoUrl: null,
    driverRating: 4.5,
    status: "completed_paid",
    pickup: { address: "רחוב הנמל 15, חיפה", city: "חיפה", lat: 32.8191, lng: 34.9983, geohash: "svd0q8" },
    destination: { address: "רחוב הגליל 8, נהריה", city: "נהריה", lat: 33.0072, lng: 35.0955, geohash: "svd3kn" },
    item: { description: "חבילת בגדים", type: "general", size: "small", photoURL: "" },
    price: 65,
    pickupDate: weekAgo.toDate().toISOString(),
    timeRange: "afternoon",
    notes: "",
    payment: { senderConfirmed: true, driverConfirmed: true },
    proof: {},
    statusHistory: [
      { status: "new", timestamp: weekAgo, actor: sender2 },
      { status: "waiting", timestamp: weekAgo, actor: driver2 },
      { status: "picked_up", timestamp: weekAgo, actor: driver2 },
      { status: "delivered", timestamp: weekAgo, actor: driver2 },
      { status: "completed_paid", timestamp: weekAgo, actor: "system" },
    ],
    ratedBySender: true,
    ratedByDriver: true,
    senderRatingGiven: { rating: 4, comment: "שירות טוב, מומלץ" },
    driverRatingGiven: { rating: 5, comment: "שולחת מסודרת, תענוג" },
    ratingsVisibleAt: weekAgo,
    interestedDrivers: [
      { uid: driver2, name: "דני אלון", photoUrl: null, rating: 4.5, completedDeliveries: 18, distanceKm: 3.0, expressedAt: weekAgo, status: "confirmed" },
    ],
    timeoutAt: weekAgo,
    createdAt: weekAgo,
    updatedAt: weekAgo,
  });
  console.log(`  ✅ Delivery 4 (COMPLETED_PAID, sender2→driver2): ${d4Ref.id}`);

  // 5. WAITING delivery (driver confirmed, ready for pickup)
  const d5Ref = db.collection("deliveries").doc();
  const chatRef = db.collection("chats").doc();
  await chatRef.set({
    deliveryId: d5Ref.id,
    participants: [sender2, driver3],
    lastMessage: "",
    lastMessageAt: now,
    lastSenderId: "",
    createdAt: now,
    closed: false,
  });
  await d5Ref.set({
    senderId: sender2,
    senderName: "רונית",
    senderPhotoUrl: null,
    senderRating: 4.3,
    driverId: driver3,
    driverName: "יעל אברהם",
    driverPhotoUrl: null,
    driverRating: 4.9,
    status: "waiting",
    pickup: { address: "רחוב אחד העם 5, חיפה", city: "חיפה", lat: 32.8150, lng: 34.9870, geohash: "svd0pz" },
    destination: { address: "רחוב הרצל 1, עכו", city: "עכו", lat: 32.9270, lng: 35.0840, geohash: "svd1nh" },
    item: { description: "מדפסת HP", type: "electronics", size: "medium", photoURL: "" },
    price: 95,
    pickupDate: "asap",
    notes: "להתקשר כשמגיעים",
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {},
    chatId: chatRef.id,
    statusHistory: [
      { status: "new", timestamp: now, actor: sender2 },
      { status: "waiting", timestamp: now, actor: driver3, note: "Driver confirmed selection" },
    ],
    interestedDrivers: [
      { uid: driver3, name: "יעל אברהם", photoUrl: null, rating: 4.9, completedDeliveries: 87, distanceKm: 2.5, expressedAt: now, status: "confirmed" },
      { uid: driver4, name: "עומר שפירא", photoUrl: null, rating: 3.9, completedDeliveries: 7, distanceKm: 12.0, expressedAt: now, status: "interested" },
    ],
    selectedDriverId: null,
    selectionExpiresAt: null,
    timeoutAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 72 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  ✅ Delivery 5 (WAITING, sender2→driver3, with chat): ${d5Ref.id}`);

  console.log("\n═══ Demo Data Summary ═══");
  console.log("Senders:");
  DEMO_SENDERS.forEach((s, i) => console.log(`  ${s.email} / ${s.password} — ${s.fullName} (uid: ${senderUids[i]})`));
  console.log("Drivers:");
  DEMO_DRIVERS.forEach((d, i) => console.log(`  ${d.email} / ${d.password} — ${d.fullName} (uid: ${driverUids[i]})`));
  console.log("\nDeliveries:");
  console.log(`  ${d1Ref.id} — NEW, 3 interested drivers (test multi-select)`);
  console.log(`  ${d2Ref.id} — NEW, no interest, scheduled tomorrow morning`);
  console.log(`  ${d3Ref.id} — COMPLETED_PAID, with ratings (test rating display)`);
  console.log(`  ${d4Ref.id} — COMPLETED_PAID, sender2→driver2`);
  console.log(`  ${d5Ref.id} — WAITING, sender2→driver3 (test pickup flow)`);
}

async function main() {
  console.log("🚀 Creating MOOVIZ demo data...\n");
  const { senderUids, driverUids } = await createDemoUsers();
  await createDemoDeliveries(senderUids, driverUids);
  console.log("\n✅ Done! Demo data created successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
