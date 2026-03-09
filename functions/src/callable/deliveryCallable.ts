import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  Delivery,
  DeliveryStatus,
  StatusEntry,
} from "@mooviz/shared";
import {
  assertValidTransition,
  assertIsSender,
  assertIsDriver,
  assertUserRole,
} from "../validators/statusValidator";
import { sendDeliveryNotification, sendPushNotification } from "../services/notificationService";

const db = admin.firestore();

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
 * Driver expresses interest in a delivery.
 * Transitions: new -> pending
 */
export const expressInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  await assertUserRole(db, uid, "driver");

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

  await updateDeliveryStatus(
    ref,
    "pending",
    uid,
    "Driver expressed interest",
    { driverId: uid }
  );

  // Notify the sender
  await sendDeliveryNotification(deliveryId, "driver_interested", {
    actorId: uid,
  });

  return { success: true, message: "Interest expressed successfully" };
});

/**
 * Sender approves a driver for a delivery.
 * Transitions: pending -> waiting
 */
export const approveDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
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

  await updateDeliveryStatus(
    ref,
    "waiting",
    uid,
    "Sender approved driver"
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

  // Notify the other party
  const cancellerName = isSender ? "sender" : "driver";
  await sendDeliveryNotification(deliveryId, "delivery_cancelled", {
    actorId: uid,
    cancelledBy: cancellerName,
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
