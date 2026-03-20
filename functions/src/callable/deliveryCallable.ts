import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  Delivery,
  DeliveryStatus,
  StatusEntry,
  DEFAULT_TIMEOUT_HOURS,
} from "@mooviz/shared";
import {
  assertValidTransition,
  assertIsSender,
  assertIsDriver,
  assertUserRole,
  assertDriverApproved,
} from "../validators/statusValidator";
import { sendDeliveryNotification, sendPushNotification } from "../services/notificationService";
import { getNearbyDriverTokensMultiLocation, encodeGeohash } from "../services/geohashService";

const db = admin.firestore();
const GEOHASH_PRECISION = 7;

/**
 * Helper to get a delivery document or throw.
 */
async function getDeliveryOrThrow(
  deliveryId: string
): Promise<{ delivery: Delivery; ref: FirebaseFirestore.DocumentReference }> {
  if (!deliveryId || typeof deliveryId !== "string") {
    throw new HttpsError("invalid-argument", "deliveryId is required");
  }

  const ref = db.collection("deliveries").doc(deliveryId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new HttpsError("not-found", `Delivery ${deliveryId} not found`);
  }

  return { delivery: doc.data() as Delivery, ref };
}

/**
 * Helper to add a status entry and update the delivery.
 */
async function updateDeliveryStatus(
  ref: FirebaseFirestore.DocumentReference,
  newStatus: DeliveryStatus,
  actor: string,
  note?: string,
  extraFields?: Record<string, unknown>
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const statusEntry: StatusEntry = {
    status: newStatus,
    timestamp: now,
    actor,
    note,
  };

  await ref.update({
    status: newStatus,
    statusHistory: admin.firestore.FieldValue.arrayUnion(statusEntry),
    updatedAt: now,
    ...extraFields,
  });
}

/**
 * Create a new delivery.
 * Validates input, normalizes field names to HLD format, computes geohash,
 * denormalizes sender info, and notifies nearby drivers.
 */
export const createDelivery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const senderData = await assertUserRole(db, uid, "sender");

  const d = request.data;

  // --- Extract & normalize coordinates ---
  const pickupRaw = d.pickup;
  const destRaw = d.destination;
  if (!pickupRaw || !destRaw) {
    throw new HttpsError("invalid-argument", "pickup and destination are required");
  }

  const pickupLat = pickupRaw.lat ?? pickupRaw.latitude;
  const pickupLng = pickupRaw.lng ?? pickupRaw.longitude;
  const destLat = destRaw.lat ?? destRaw.latitude;
  const destLng = destRaw.lng ?? destRaw.longitude;

  if (typeof pickupLat !== "number" || typeof pickupLng !== "number") {
    throw new HttpsError("invalid-argument", "pickup must have valid lat/lng");
  }
  if (typeof destLat !== "number" || typeof destLng !== "number") {
    throw new HttpsError("invalid-argument", "destination must have valid lat/lng");
  }

  // --- Normalize item ---
  const itemDescription: string =
    d.item?.description ?? d.itemDescription ?? "";
  const itemSize: string = d.item?.size ?? d.itemSize ?? "";
  const itemType: string = d.item?.type ?? d.itemType ?? "general";
  const photoURL: string = d.item?.photoURL ?? d.photoUrl ?? "";
  const mediaURLs: string[] = Array.isArray(d.mediaURLs) ? d.mediaURLs : [];

  if (!itemDescription) {
    throw new HttpsError("invalid-argument", "item description is required");
  }

  // --- Normalize price ---
  const price: number = typeof d.price === "number" ? d.price
    : typeof d.suggestedPrice === "number" ? d.suggestedPrice : 0;
  if (price <= 0) {
    throw new HttpsError("invalid-argument", "price must be a positive number");
  }

  // --- Normalize pickupDate ---
  const rawDate = d.pickupDate ?? d.scheduledDate;
  let pickupDate: admin.firestore.Timestamp | "asap";
  if (!rawDate || rawDate === "asap") {
    pickupDate = "asap";
  } else if (typeof rawDate === "string") {
    const ms = Date.parse(rawDate);
    if (isNaN(ms)) {
      throw new HttpsError("invalid-argument", "Invalid date format for pickupDate");
    }
    pickupDate = admin.firestore.Timestamp.fromMillis(ms);
  } else {
    pickupDate = "asap";
  }

  // --- Normalize timeRange ---
  const VALID_TIME_RANGES = ["morning", "afternoon", "evening", "night"];
  const timeRange: string | null =
    typeof d.timeRange === "string" && VALID_TIME_RANGES.includes(d.timeRange)
      ? d.timeRange
      : null;

  // --- Compute geohash ---
  const pickupGeohash = encodeGeohash(pickupLat, pickupLng, GEOHASH_PRECISION);
  const destGeohash = encodeGeohash(destLat, destLng, GEOHASH_PRECISION);

  // --- Duplicate delivery check ---
  // Reject if sender already has an active delivery with same pickup+destination geohash
  const recentDupes = await db.collection("deliveries")
    .where("senderId", "==", uid)
    .where("status", "in", ["new", "pending", "awaiting_confirm", "waiting_for_pickup"])
    .where("pickup.geohash", "==", pickupGeohash)
    .where("destination.geohash", "==", destGeohash)
    .limit(1)
    .get();

  if (!recentDupes.empty) {
    throw new HttpsError(
      "already-exists",
      "יש לך כבר משלוח פעיל לאותו יעד. בטל אותו קודם או המתן לסיומו."
    );
  }

  // --- Sender info (already fetched by assertUserRole) ---
  const senderName = senderData?.nickname || senderData?.fullName || "";
  const senderPhotoUrl = senderData?.profilePhotoURL || "";
  const senderRating = senderData?.ratingAsSender?.average ?? null;

  // --- Build delivery document (HLD-canonical format) ---
  const now = admin.firestore.Timestamp.now();
  const timeoutAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + DEFAULT_TIMEOUT_HOURS * 60 * 60 * 1000
  );

  const deliveryDoc = {
    senderId: uid,
    senderName,
    senderPhotoUrl,
    senderRating,
    driverId: null,
    status: "new" as DeliveryStatus,
    pickup: {
      address: pickupRaw.address ?? "",
      city: pickupRaw.city ?? "",
      lat: pickupLat,
      lng: pickupLng,
      geohash: pickupGeohash,
    },
    destination: {
      address: destRaw.address ?? "",
      city: destRaw.city ?? "",
      lat: destLat,
      lng: destLng,
      geohash: destGeohash,
    },
    item: {
      description: itemDescription,
      type: itemType,
      size: itemSize,
      photoURL,
    },
    mediaURLs,
    price,
    pickupDate,
    timeRange,
    notes: d.notes ?? "",
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {},
    statusHistory: [
      {
        status: "new" as DeliveryStatus,
        timestamp: now,
        actor: uid,
        note: "Delivery created",
      },
    ],
    interestedDrivers: [],
    timeoutAt,
    // Expansion tracking — required by notifyExpansion scheduled function
    notifiedDrivers: [],
    notifyRadius: 15,
    notifyExpansionCount: 0,
    lastNotifyExpansion: now,
    createdAt: now,
    updatedAt: now,
  };

  // --- Write to Firestore ---
  const docRef = await db.collection("deliveries").add(deliveryDoc);
  const deliveryId = docRef.id;

  console.log(`createDelivery: ${deliveryId} created by ${uid}`);

  // --- Notify nearby drivers (fire-and-forget — don't block response) ---
  // Uses multi-location matching: checks driver's live GPS, home address, and work address
  if (pickupGeohash) {
    const pickupCity = pickupRaw.city ?? "";
    const destCity = destRaw.city ?? "";
    getNearbyDriverTokensMultiLocation(pickupGeohash, 15, pickupLat, pickupLng, undefined, itemSize || undefined)
      .then(async (nearbyDrivers) => {
        await Promise.all(
          nearbyDrivers.map((driver) =>
            sendPushNotification(
              driver.uid,
              "משלוח חדש באזורך",
              `משלוח חדש מ-${pickupCity} ל-${destCity} - ${price} ₪`,
              {
                event: "new_listing_nearby",
                deliveryId,
                pickupCity,
                destinationCity: destCity,
                price: String(price),
              }
            )
          )
        );
        // Record notified drivers so expansion function skips them
        if (nearbyDrivers.length > 0) {
          await docRef.update({
            notifiedDrivers: nearbyDrivers.map((d) => d.uid),
          });
        }
        console.log(`createDelivery: notified ${nearbyDrivers.length} nearby drivers (multi-location)`);
      })
      .catch((err) => console.error("createDelivery: nearby driver notification failed:", err));
  }

  return { success: true, deliveryId };
});

/**
 * Driver expresses interest in a delivery.
 * Appends driver entry to interestedDrivers array (status stays 'new').
 * Does NOT transition delivery status — sender selects a driver separately.
 */
export const expressInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const driverData = await assertUserRole(db, uid, "driver");
  await assertDriverApproved(db, uid);
  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  if (delivery.status !== "new") {
    throw new HttpsError("failed-precondition", "המשלוח חייב להיות בסטטוס חדש");
  }
  if (delivery.senderId === uid) {
    throw new HttpsError("permission-denied", "לא ניתן להביע עניין במשלוח שלך");
  }

  // Transaction: atomic read-check-append
  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    const interested: any[] = freshData.interestedDrivers || [];

    if (interested.length >= 30) {
      throw new HttpsError("resource-exhausted", "הגעת למקסימום נהגים מעוניינים");
    }

    const existing = interested.find((d: any) => d.uid === uid);
    if (existing) {
      if (existing.status === "withdrawn") {
        // Re-entry after withdrawal
        const updated = interested.map((d: any) =>
          d.uid === uid
            ? { ...d, status: "interested", expressedAt: admin.firestore.Timestamp.now() }
            : d
        );
        txn.update(ref, { interestedDrivers: updated, updatedAt: admin.firestore.Timestamp.now() });
        return;
      }
      throw new HttpsError("already-exists", "כבר הבעת עניין או שנדחית בעבר");
    }

    // Compute distance from pickup
    const pickupLat = freshData.pickup?.lat ?? freshData.pickup?.latitude;
    const pickupLng = freshData.pickup?.lng ?? freshData.pickup?.longitude;
    const driverLat = driverData.location?.lat;
    const driverLng = driverData.location?.lng;
    let distanceKm = 0;
    if (pickupLat && pickupLng && driverLat && driverLng) {
      const R = 6371;
      const dLat = ((driverLat - pickupLat) * Math.PI) / 180;
      const dLon = ((driverLng - pickupLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((pickupLat * Math.PI) / 180) *
          Math.cos((driverLat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const entry = {
      uid,
      name: driverData.nickname || driverData.fullName || "",
      photoUrl: driverData.profilePhotoURL || null,
      rating: driverData.ratingAsDriver?.average ?? 0,
      completedDeliveries: driverData.completedDeliveries ?? 0,
      distanceKm: Math.round(distanceKm * 10) / 10,
      expressedAt: admin.firestore.Timestamp.now(),
      status: "interested",
    };

    txn.update(ref, {
      interestedDrivers: [...interested, entry],
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

  // Fire-and-forget: notify sender
  const driverName = driverData.nickname || driverData.fullName || "";
  sendPushNotification(
    delivery.senderId,
    "נהג חדש מעוניין",
    `${driverName} רוצה לאסוף את המשלוח שלך`,
    { event: "driver_interested", deliveryId, driverName }
  ).catch((err: unknown) => console.error("expressInterest notification failed:", err));

  return { success: true };
});

/**
 * Sender selects a driver from the interested list.
 * Marks the driver as "selected" and sets a 15-minute confirmation window.
 */
export const selectDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId, driverUid } = request.data;
  if (!deliveryId || !driverUid) throw new HttpsError("invalid-argument", "deliveryId and driverUid are required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);
  if (delivery.senderId !== uid) throw new HttpsError("permission-denied", "רק השולח יכול לבחור נהג");

  const SELECTION_TIMEOUT_MS = 15 * 60 * 1000;

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    if (!["new", "pending"].includes(freshData.status)) throw new HttpsError("failed-precondition", "המשלוח חייב להיות בסטטוס חדש או ממתין");
    if (freshData.selectedDriverId) throw new HttpsError("failed-precondition", "נהג אחר כבר נבחר, המתן או בטל");

    const interested: any[] = freshData.interestedDrivers || [];
    const driverEntry = interested.find((d: any) => d.uid === driverUid && d.status === "interested");
    if (!driverEntry) throw new HttpsError("not-found", "הנהג לא נמצא ברשימה או לא זמין");

    const updated = interested.map((d: any) => d.uid === driverUid ? { ...d, status: "selected" } : d);
    const selectedEntry = interested.find((d: any) => d.uid === driverUid);
    const now = admin.firestore.Timestamp.now();

    txn.update(ref, {
      status: "awaiting_confirm",
      driverId: driverUid, // Set early so driver sees it in My Jobs
      driverName: selectedEntry?.name || "",
      driverPhotoUrl: selectedEntry?.photoUrl || null,
      driverRating: selectedEntry?.rating || 0,
      interestedDrivers: updated,
      selectedDriverId: driverUid,
      selectionExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + SELECTION_TIMEOUT_MS),
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "awaiting_confirm",
        timestamp: now,
        actor: uid,
        note: "Sender selected driver, waiting for confirmation",
      }),
      updatedAt: now,
    });
  });

  sendPushNotification(driverUid, "השולח בחר בך!", "אשר את המשלוח תוך 15 דקות", { event: "driver_selected", deliveryId })
    .catch((err: unknown) => console.error("selectDriver notification failed:", err));

  console.log(`selectDriver: sender ${uid} selected driver ${driverUid} for delivery ${deliveryId}`);
  return { success: true };
});

/**
 * Selected driver confirms the assignment.
 * Transitions: awaiting_confirm -> waiting_for_pickup. Creates a chat room.
 */
export const confirmSelection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);

  let senderId = "";
  let driverName = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    senderId = freshData.senderId;

    if (freshData.status !== "awaiting_confirm") throw new HttpsError("failed-precondition", "המשלוח חייב להיות בסטטוס ממתין לאישור");
    if (freshData.selectedDriverId !== uid) throw new HttpsError("permission-denied", "אתה לא הנהג שנבחר");

    const expiresAt = freshData.selectionExpiresAt;
    if (expiresAt && expiresAt.toMillis() < Date.now()) throw new HttpsError("deadline-exceeded", "פג תוקף הבחירה");

    const interested: any[] = freshData.interestedDrivers || [];
    const driverEntry = interested.find((d: any) => d.uid === uid);
    driverName = driverEntry?.name || "";

    const updatedInterested = interested.map((d: any) => d.uid === uid ? { ...d, status: "confirmed" } : d);
    const now = admin.firestore.Timestamp.now();

    // Create chat
    const chatRef = db.collection("chats").doc();
    txn.set(chatRef, {
      deliveryId,
      participants: [freshData.senderId, uid],
      lastMessage: "",
      lastMessageAt: now,
      lastSenderId: "",
      createdAt: now,
      closed: false,
    });

    txn.update(ref, {
      status: "waiting_for_pickup",
      driverId: uid,
      driverName: driverEntry?.name || "",
      driverPhotoUrl: driverEntry?.photoUrl || null,
      driverRating: driverEntry?.rating || 0,
      interestedDrivers: updatedInterested,
      selectedDriverId: null,
      selectionExpiresAt: null,
      chatId: chatRef.id,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "waiting_for_pickup",
        timestamp: now,
        actor: uid,
        note: "Driver confirmed selection",
      }),
      updatedAt: now,
    });
  });

  sendPushNotification(senderId, "הנהג אישר!", `המשלוח שויך ל-${driverName}`, { event: "driver_confirmed", deliveryId })
    .catch((err: unknown) => console.error("confirmSelection notification failed:", err));

  console.log(`confirmSelection: driver ${uid} confirmed for delivery ${deliveryId}`);
  return { success: true };
});

/**
 * Selected driver declines the assignment.
 * Resets selectedDriverId so sender can choose another driver.
 */
export const declineSelection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);
  let senderId = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    senderId = freshData.senderId;

    if (freshData.selectedDriverId !== uid) throw new HttpsError("permission-denied", "אתה לא הנהג שנבחר");

    const now = admin.firestore.Timestamp.now();
    const interested: any[] = freshData.interestedDrivers || [];
    const updated = interested.map((d: any) => d.uid === uid ? { ...d, status: "declined" } : d);

    txn.update(ref, {
      status: "pending",
      driverId: null,
      driverName: null,
      driverPhotoUrl: null,
      driverRating: null,
      interestedDrivers: updated,
      selectedDriverId: null,
      selectionExpiresAt: null,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "pending",
        timestamp: now,
        actor: uid,
        note: "Driver declined selection, reverted to pending",
      }),
      updatedAt: now,
    });
  });

  sendPushNotification(senderId, "הנהג דחה", "בחר נהג אחר מהרשימה", { event: "driver_declined", deliveryId })
    .catch((err: unknown) => console.error("declineSelection notification failed:", err));

  console.log(`declineSelection: driver ${uid} declined for delivery ${deliveryId}`);
  return { success: true };
});

/**
 * Sender cancels a selected or confirmed driver.
 * Reverts delivery back to 'pending' so other drivers can be selected.
 */
export const cancelSelectedDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);
  let cancelledDriverId = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    if (freshData.senderId !== uid) throw new HttpsError("permission-denied", "רק השולח יכול לבטל");

    const now = admin.firestore.Timestamp.now();
    const interested: any[] = freshData.interestedDrivers || [];

    if (freshData.status === "awaiting_confirm" && freshData.selectedDriverId) {
      // Case 1: Cancel pending selection (driver hasn't confirmed yet)
      cancelledDriverId = freshData.selectedDriverId;
      const updated = interested.map((d: any) =>
        d.uid === cancelledDriverId ? { ...d, status: "cancelled" } : d
      );
      txn.update(ref, {
        status: "pending",
        interestedDrivers: updated,
        selectedDriverId: null,
        selectionExpiresAt: null,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "pending",
          timestamp: now,
          actor: uid,
          note: "Sender cancelled pending selection, reverted to pending",
        }),
        updatedAt: now,
      });
    } else if (freshData.status === "waiting_for_pickup" && freshData.driverId) {
      // Case 2: Cancel confirmed driver (revert waiting_for_pickup → pending)
      cancelledDriverId = freshData.driverId;
      const updated = interested.map((d: any) =>
        d.uid === cancelledDriverId ? { ...d, status: "cancelled" } : d
      );
      txn.update(ref, {
        status: "pending",
        driverId: null,
        driverName: null,
        driverPhotoUrl: null,
        driverRating: null,
        interestedDrivers: updated,
        selectedDriverId: null,
        selectionExpiresAt: null,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "pending",
          timestamp: now,
          actor: uid,
          note: "Sender cancelled confirmed driver, reverted to pending",
        }),
        updatedAt: now,
      });
    } else {
      throw new HttpsError("failed-precondition", "אין בחירה ממתינה או נהג משויך לביטול");
    }
  });

  sendPushNotification(cancelledDriverId, "השולח ביטל את הבחירה", "המשלוח הוחזר לרשימה", { event: "selection_cancelled", deliveryId })
    .catch((err: unknown) => console.error("cancelSelectedDriver notification failed:", err));

  console.log(`cancelSelectedDriver: sender ${uid} cancelled driver ${cancelledDriverId} for delivery ${deliveryId}`);
  return { success: true };
});

/**
 * Driver removes themselves from the interested list.
 * Only allowed while their status is still "interested" (not selected/confirmed).
 */
export const withdrawFromInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    const interested: any[] = freshData.interestedDrivers || [];
    const entry = interested.find((d: any) => d.uid === uid);

    if (!entry || entry.status !== "interested") {
      throw new HttpsError("failed-precondition", "לא נמצא ברשימה או כבר נבחר/נדחה");
    }

    const updated = interested.map((d: any) => d.uid === uid ? { ...d, status: "withdrawn" } : d);

    txn.update(ref, {
      interestedDrivers: updated,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

  console.log(`withdrawFromInterest: driver ${uid} withdrew from delivery ${deliveryId}`);
  return { success: true };
});

/**
 * Sender approves a driver for a delivery.
 * Transitions: pending -> waiting_for_pickup
 * Creates a chat room between sender and driver.
 * Denormalizes sender info onto the delivery document.
 */
export const approveDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  console.log(`approveDriver: sender ${uid} approving delivery ${deliveryId}`);
  await assertUserRole(db, uid, "sender");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the sender
  assertIsSender(delivery.senderId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "waiting_for_pickup", "sender", uid);

  if (!delivery.driverId) {
    throw new HttpsError(
      "failed-precondition",
      "No driver has expressed interest yet"
    );
  }

  // Lookup sender info for denormalization
  const senderDoc = await db.collection("users").doc(uid).get();
  const senderData = senderDoc.data();
  const senderName = senderData?.nickname || senderData?.fullName || "";
  const senderPhotoUrl = senderData?.profilePhotoURL || "";
  const senderRating = senderData?.ratingAsSender?.average ?? null;

  // Create chat room between sender and driver
  const chatRef = db.collection("chats").doc();
  const now = admin.firestore.Timestamp.now();
  await chatRef.set({
    deliveryId,
    participants: [uid, delivery.driverId],
    senderName,
    driverName: delivery.driverName || "",
    lastMessage: "צ'אט נוצר — משלוח אושר",
    lastMessageAt: now,
    closed: false,
    createdAt: now,
  });

  // Add system message to chat
  await chatRef.collection("messages").add({
    type: "system",
    text: "✅ המשלוח אושר — אפשר לתאם איסוף",
    senderId: "system",
    createdAt: now,
  });

  await updateDeliveryStatus(
    ref,
    "waiting_for_pickup",
    uid,
    "Sender approved driver",
    {
      chatId: chatRef.id,
      senderName,
      senderPhotoUrl,
      senderRating,
    }
  );

  // Notify the driver
  await sendDeliveryNotification(deliveryId, "sender_approved", {
    actorId: uid,
  });

  return { success: true, message: "Driver approved successfully" };
});

/**
 * Driver confirms pickup of the item.
 * Transitions: waiting -> picked_up
 * Requires proof photo URL.
 */
export const confirmPickup = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, pickupPhotoURL } = request.data;

  if (!pickupPhotoURL || typeof pickupPhotoURL !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "pickupPhotoURL is required as proof of pickup"
    );
  }

  await assertUserRole(db, uid, "driver");
  await assertDriverApproved(db, uid);

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the assigned driver
  assertIsDriver(delivery.driverId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "picked_up", "driver", uid);

  await updateDeliveryStatus(
    ref,
    "picked_up",
    uid,
    "Driver confirmed pickup",
    {
      "proof.pickupURL": pickupPhotoURL,
    }
  );

  // Notify the sender
  await sendDeliveryNotification(deliveryId, "delivery_picked_up", {
    actorId: uid,
  });

  return { success: true, message: "Pickup confirmed successfully" };
});

/**
 * Driver confirms delivery of the item.
 * Transitions: picked_up -> delivered
 * Requires proof photo URL.
 */
export const confirmDelivery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, deliveryPhotoURL } = request.data;

  if (!deliveryPhotoURL || typeof deliveryPhotoURL !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "deliveryPhotoURL is required as proof of delivery"
    );
  }

  await assertUserRole(db, uid, "driver");
  await assertDriverApproved(db, uid);

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the assigned driver
  assertIsDriver(delivery.driverId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "delivered", "driver", uid);

  await updateDeliveryStatus(
    ref,
    "delivered",
    uid,
    "Driver confirmed delivery",
    {
      "proof.deliveryURL": deliveryPhotoURL,
    }
  );

  // Notify the sender
  await sendDeliveryNotification(deliveryId, "delivery_delivered", {
    actorId: uid,
  });

  return { success: true, message: "Delivery confirmed successfully" };
});

/**
 * Either party confirms payment has been sent/received.
 * First confirm: delivered -> awaiting_payment
 * Second confirm: awaiting_payment -> completed_paid
 */
export const confirmPayment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, paymentPhotoURL } = request.data;
  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Allow payment confirmation in both delivered and awaiting_payment
  if (delivery.status !== "delivered" && delivery.status !== "awaiting_payment") {
    throw new HttpsError(
      "failed-precondition",
      "Payment can only be confirmed when status is 'delivered' or 'awaiting_payment'"
    );
  }

  const isSender = delivery.senderId === uid;
  const isDriver = delivery.driverId === uid;

  if (!isSender && !isDriver) {
    throw new HttpsError(
      "permission-denied",
      "Only the sender or driver can confirm payment"
    );
  }

  // Check for double-confirm
  if (isSender && delivery.payment.senderConfirmed) {
    throw new HttpsError("already-exists", "Sender has already confirmed payment");
  }
  if (isDriver && delivery.payment.driverConfirmed) {
    throw new HttpsError("already-exists", "Driver has already confirmed payment");
  }

  const now = admin.firestore.Timestamp.now();
  const updateData: Record<string, unknown> = {
    updatedAt: now,
  };

  // Set the caller's confirmation flag
  if (isSender) {
    updateData["payment.senderConfirmed"] = true;
  }
  if (isDriver) {
    updateData["payment.driverConfirmed"] = true;
  }

  // Store payment proof photo if provided
  if (paymentPhotoURL && typeof paymentPhotoURL === "string") {
    updateData["proof.paymentURL"] = paymentPhotoURL;
  }

  // Determine if this is the first or second confirmation
  const otherConfirmed = isSender
    ? delivery.payment.driverConfirmed
    : delivery.payment.senderConfirmed;

  if (!otherConfirmed) {
    // FIRST confirmation → transition to awaiting_payment
    updateData.status = "awaiting_payment";
    updateData.statusHistory = admin.firestore.FieldValue.arrayUnion({
      status: "awaiting_payment",
      timestamp: now,
      actor: uid,
      note: `${isSender ? "Sender" : "Driver"} confirmed payment, waiting for other party`,
    });

    await ref.update(updateData);

    // Notify the OTHER party: "your turn to confirm"
    await sendDeliveryNotification(deliveryId, "awaiting_payment_notify", {
      actorId: uid,
    });
  } else {
    // SECOND confirmation → transition to completed_paid
    // Use transaction for atomicity (prevent double-increment)
    await db.runTransaction(async (txn) => {
      const freshDoc = await txn.get(ref);
      const freshData = freshDoc.data();
      if (!freshData || freshData.status !== "awaiting_payment") {
        console.log(`Delivery ${deliveryId} already completed (status=${freshData?.status}), skipping`);
        return;
      }

      const completionEntry = {
        status: "completed_paid" as const,
        timestamp: now,
        actor: uid,
        note: "Both parties confirmed payment",
      };

      txn.update(ref, {
        ...updateData,
        status: "completed_paid",
        statusHistory: admin.firestore.FieldValue.arrayUnion(completionEntry),
      });

      // Increment completedDeliveries for both users
      if (freshData.senderId) {
        txn.update(db.collection("users").doc(freshData.senderId), {
          completedDeliveries: admin.firestore.FieldValue.increment(1),
        });
      }
      if (freshData.driverId) {
        txn.update(db.collection("users").doc(freshData.driverId), {
          completedDeliveries: admin.firestore.FieldValue.increment(1),
        });
      }
    });

    // Notify both parties
    await sendDeliveryNotification(deliveryId, "payment_confirmed", {
      actorId: uid,
    });
  }

  return { success: true, message: "Payment confirmation recorded" };
});

/**
 * Cancel a delivery.
 * Only allowed before pickup (status: new, pending, awaiting_confirm, waiting_for_pickup).
 */
export const cancelDelivery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, reason } = request.data;

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is either the sender or the assigned driver
  const isSender = delivery.senderId === uid;
  const isDriver = delivery.driverId === uid;

  if (!isSender && !isDriver) {
    throw new HttpsError(
      "permission-denied",
      "Only the sender or assigned driver can cancel this delivery"
    );
  }

  // Determine actor role
  const actorRole = isSender ? "sender" : "driver";

  // Validate transition
  assertValidTransition(delivery.status, "cancelled", actorRole, uid);

  await updateDeliveryStatus(
    ref,
    "cancelled",
    uid,
    reason ?? "Cancelled by user",
    {
      cancelledBy: uid,
    }
  );

  // If a driver was assigned but is not the canceller, reset the delivery
  // so another driver could potentially pick it up
  // (only if the sender cancels — driver cancel is permanent)

  // Notify the other party (Hebrew role names for notification text)
  const cancellerNameHe = isSender ? "השולח" : "הנהג";
  await sendDeliveryNotification(deliveryId, "delivery_cancelled", {
    actorId: uid,
    cancelledBy: cancellerNameHe,
  });

  return { success: true, message: "Delivery cancelled successfully" };
});

/**
 * Sender declines an interested driver.
 * Transitions: pending -> new (resets driver assignment)
 */
export const declineDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify caller is the sender
  assertIsSender(delivery.senderId, uid);

  // Can only decline when status is pending
  if (delivery.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      "Can only decline a driver when delivery status is 'pending'"
    );
  }

  const declinedDriverId = delivery.driverId;

  await updateDeliveryStatus(
    ref,
    "new",
    uid,
    "Sender declined driver",
    { driverId: null }
  );

  // Notify the declined driver
  if (declinedDriverId) {
    await sendPushNotification(
      declinedDriverId,
      "השולח בחר נהג אחר",
      "השולח בחר נהג אחר למשלוח זה",
      { event: "driver_declined", deliveryId }
    );
  }

  return { success: true, message: "Driver declined successfully" };
});

/**
 * Driver withdraws their interest from a delivery.
 * Transitions: pending -> new (resets driver assignment)
 * Re-notifies nearby drivers about the available delivery.
 */
export const withdrawInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the assigned driver
  assertIsDriver(delivery.driverId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "new", "driver", uid);

  console.log(`withdrawInterest: driver ${uid} withdrawing from delivery ${deliveryId}`);

  await updateDeliveryStatus(
    ref,
    "new",
    uid,
    "Driver withdrew interest",
    {
      driverId: null,
      driverName: null,
      driverPhotoUrl: null,
      driverRating: null,
    }
  );

  // Notify the sender
  try {
    await sendPushNotification(
      delivery.senderId,
      "הנהג ביטל את ההתעניינות",
      "הנהג ביטל את ההתעניינות במשלוח שלך",
      { event: "driver_withdrew", deliveryId }
    );
  } catch (notifErr: unknown) {
    console.error("withdrawInterest: sender notification failed:", notifErr);
  }

  // Re-notify nearby drivers about the now-available delivery
  const pickupGeohash = delivery.pickup?.geohash;
  if (pickupGeohash) {
    const pickupCity = delivery.pickup?.city ?? "";
    const destCity = delivery.destination?.city ?? "";
    getNearbyDriverTokensMultiLocation(pickupGeohash, 15, delivery.pickup?.lat, delivery.pickup?.lng, [uid])
      .then((nearbyDrivers: import("../services/geohashService").NearbyDriver[]) =>
        Promise.all(
          nearbyDrivers.map((driver: import("../services/geohashService").NearbyDriver) =>
            sendPushNotification(
              driver.uid,
              "משלוח חדש באזורך",
              `משלוח מ-${pickupCity} ל-${destCity} - ${delivery.price} ₪`,
              {
                event: "new_listing_nearby",
                deliveryId,
                pickupCity,
                destinationCity: destCity,
                price: String(delivery.price ?? 0),
              }
            )
          )
        ).then(() => console.log(`withdrawInterest: notified ${nearbyDrivers.length} nearby drivers (multi-location)`))
      )
      .catch((err: unknown) => console.error("withdrawInterest: nearby driver notification failed:", err));
  }

  return { success: true };
});

/**
 * Submit a rating for the other party after delivery.
 * Validates caller is sender or driver, delivery is delivered/completed_paid,
 * and the caller hasn't already rated. Uses a transaction for atomic aggregate updates.
 */
export const submitRating = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, rating, comment } = request.data;

  // Validate rating value
  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new HttpsError("invalid-argument", "Rating must be an integer between 1 and 5");
  }

  if (comment !== undefined && typeof comment !== "string") {
    throw new HttpsError("invalid-argument", "Comment must be a string");
  }

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Validate delivery status
  if (delivery.status !== "delivered" && delivery.status !== "completed_paid") {
    throw new HttpsError(
      "failed-precondition",
      "Ratings can only be submitted when delivery status is 'delivered' or 'completed_paid'"
    );
  }

  // Determine caller's role in this delivery
  const isSender = delivery.senderId === uid;
  const isDriver = delivery.driverId === uid;

  if (!isSender && !isDriver) {
    throw new HttpsError(
      "permission-denied",
      "Only the sender or driver of this delivery can submit a rating"
    );
  }

  // Check if already rated
  if (isSender && delivery.ratedBySender) {
    throw new HttpsError("already-exists", "Sender has already rated this delivery");
  }
  if (isDriver && delivery.ratedByDriver) {
    throw new HttpsError("already-exists", "Driver has already rated this delivery");
  }

  const callerRole = isSender ? "sender" : "driver";
  const targetUserId = isSender ? delivery.driverId! : delivery.senderId;
  const now = admin.firestore.Timestamp.now();

  // Determine which aggregate field to update on the target user
  // Sender rates the driver -> update ratingAsDriver
  // Driver rates the sender -> update ratingAsSender
  const ratingField = isSender ? "ratingAsDriver" : "ratingAsSender";

  // Check if the other party has already rated
  const otherRated = isSender ? !!delivery.ratedByDriver : !!delivery.ratedBySender;
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const ratingsVisibleAt = otherRated
    ? now
    : admin.firestore.Timestamp.fromMillis(now.toMillis() + FIVE_DAYS_MS);

  // Use a transaction to atomically update the target user's aggregate rating
  await db.runTransaction(async (transaction) => {
    const targetUserRef = db.collection("users").doc(targetUserId);
    const targetUserDoc = await transaction.get(targetUserRef);

    if (!targetUserDoc.exists) {
      throw new HttpsError("not-found", `Target user ${targetUserId} not found`);
    }

    const targetUserData = targetUserDoc.data()!;
    const currentRating = targetUserData[ratingField] ?? { average: 0, count: 0 };
    const currentAvg: number = currentRating.average ?? 0;
    const currentCount: number = currentRating.count ?? 0;

    // Recalculate average
    const newCount = currentCount + 1;
    const newAverage = ((currentAvg * currentCount) + rating) / newCount;

    // Update target user's aggregate rating
    transaction.update(targetUserRef, {
      [ratingField]: {
        average: Math.round(newAverage * 100) / 100, // round to 2 decimal places
        count: newCount,
      },
    });

    // Create rating document
    const ratingDocRef = db.collection("ratings").doc();
    transaction.set(ratingDocRef, {
      deliveryId,
      fromUserId: uid,
      targetUserId,
      rating,
      comment: comment ?? "",
      role: callerRole,
      createdAt: now,
    });

    // Update delivery document — include rating summary for card display
    const deliveryUpdate: Record<string, unknown> = {
      updatedAt: now,
      ratingsVisibleAt,
    };
    // Store rating summary on delivery doc (for card/detail display without extra queries)
    const ratingSummaryKey = isSender ? "senderRatingGiven" : "driverRatingGiven";
    deliveryUpdate[ratingSummaryKey] = {
      rating,
      comment: (comment ?? "").slice(0, 100),
    };
    if (isSender) {
      deliveryUpdate.ratedBySender = true;
    } else {
      deliveryUpdate.ratedByDriver = true;
    }
    // If both have now rated, update ratingsVisibleAt to now
    if (otherRated) {
      deliveryUpdate.ratingsVisibleAt = now;
    }
    transaction.update(ref, deliveryUpdate);
  });

  console.log(`submitRating: ${callerRole} ${uid} rated ${targetUserId} with ${rating} for delivery ${deliveryId}`);

  return { success: true };
});
