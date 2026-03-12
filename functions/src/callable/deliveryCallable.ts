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
} from "../validators/statusValidator";
import { sendDeliveryNotification, sendPushNotification } from "../services/notificationService";
import { getNearbyDriverTokens, encodeGeohash } from "../services/geohashService";

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

  // --- Compute geohash ---
  const pickupGeohash = encodeGeohash(pickupLat, pickupLng, GEOHASH_PRECISION);
  const destGeohash = encodeGeohash(destLat, destLng, GEOHASH_PRECISION);

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
    createdAt: now,
    updatedAt: now,
  };

  // --- Write to Firestore ---
  const docRef = await db.collection("deliveries").add(deliveryDoc);
  const deliveryId = docRef.id;

  console.log(`createDelivery: ${deliveryId} created by ${uid}`);

  // --- Notify nearby drivers (fire-and-forget — don't block response) ---
  if (pickupGeohash) {
    const pickupCity = pickupRaw.city ?? "";
    const destCity = destRaw.city ?? "";
    getNearbyDriverTokens(pickupGeohash, 15, pickupLat, pickupLng)
      .then((nearbyDrivers) =>
        Promise.all(
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
        ).then(() => console.log(`createDelivery: notified ${nearbyDrivers.length} nearby drivers`))
      )
      .catch((err) => console.error("createDelivery: nearby driver notification failed:", err));
  }

  return { success: true, deliveryId };
});

/**
 * Driver expresses interest in a delivery.
 * Transitions: new -> pending
 * Denormalizes driver info onto the delivery document.
 */
export const expressInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  const driverData = await assertUserRole(db, uid, "driver");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Validate transition
  assertValidTransition(delivery.status, "pending", "driver", uid);

  // A driver cannot express interest in their own delivery
  if (delivery.senderId === uid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot express interest in your own delivery"
    );
  }

  // Driver info (already fetched by assertUserRole)
  const driverName = driverData?.nickname || driverData?.fullName || "";
  const driverPhotoUrl = driverData?.profilePhotoURL || "";
  const driverRating = driverData?.ratingAsDriver?.average ?? null;

  console.log(`expressInterest: driver ${uid} -> delivery ${deliveryId} (sender: ${delivery.senderId})`);

  await updateDeliveryStatus(
    ref,
    "pending",
    uid,
    "Driver expressed interest",
    {
      driverId: uid,
      driverName,
      driverPhotoUrl,
      driverRating,
    }
  );

  console.log(`expressInterest: status updated to pending, sending notification to sender ${delivery.senderId}`);

  // Notify the sender
  try {
    await sendDeliveryNotification(deliveryId, "driver_interested", {
      actorId: uid,
      driverName,
    });
    console.log(`expressInterest: notification sent successfully`);
  } catch (notifErr: unknown) {
    console.error(`expressInterest: notification failed:`, notifErr);
  }

  return { success: true, message: "Interest expressed successfully" };
});

/**
 * Sender approves a driver for a delivery.
 * Transitions: pending -> waiting
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
  assertValidTransition(delivery.status, "waiting", "sender", uid);

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
    "waiting",
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
 * When both confirm, system triggers: delivered -> completed_paid (handled in trigger).
 */
export const confirmPayment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, paymentPhotoURL } = request.data;

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  if (delivery.status !== "delivered") {
    throw new HttpsError(
      "failed-precondition",
      "Payment can only be confirmed when delivery status is 'delivered'"
    );
  }

  // Determine if the caller is the sender or driver
  const isSender = delivery.senderId === uid;
  const isDriver = delivery.driverId === uid;

  if (!isSender && !isDriver) {
    throw new HttpsError(
      "permission-denied",
      "Only the sender or driver can confirm payment"
    );
  }

  const updateData: Record<string, unknown> = {
    updatedAt: admin.firestore.Timestamp.now(),
  };

  if (isSender) {
    if (delivery.payment.senderConfirmed) {
      throw new HttpsError(
        "already-exists",
        "Sender has already confirmed payment"
      );
    }
    updateData["payment.senderConfirmed"] = true;
  }

  if (isDriver) {
    if (delivery.payment.driverConfirmed) {
      throw new HttpsError(
        "already-exists",
        "Driver has already confirmed payment"
      );
    }
    if (!delivery.payment.senderConfirmed) {
      throw new HttpsError(
        "failed-precondition",
        "Sender must confirm payment before driver can confirm"
      );
    }
    updateData["payment.driverConfirmed"] = true;
  }

  // Store payment proof photo if provided
  if (paymentPhotoURL && typeof paymentPhotoURL === "string") {
    updateData["proof.paymentURL"] = paymentPhotoURL;
  }

  await ref.update(updateData);

  // Notify the other party
  await sendDeliveryNotification(deliveryId, "payment_confirmed", {
    actorId: uid,
  });

  return { success: true, message: "Payment confirmation recorded" };
});

/**
 * Cancel a delivery.
 * Only allowed before pickup (status: new, pending, waiting).
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
