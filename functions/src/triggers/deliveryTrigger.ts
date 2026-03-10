import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {
  Delivery,
  DeliveryStatus,
  StatusEntry,
  validateDeliveryCreate,
  validateStatusTransition,
  DEFAULT_TIMEOUT_HOURS,
} from "@mooviz/shared";
import { sendDeliveryNotification } from "../services/notificationService";
import { getNearbyDriverTokens } from "../services/geohashService";
import { sendPushNotification } from "../services/notificationService";

const db = admin.firestore();

/**
 * Firestore onCreate trigger for deliveries.
 * - Validates delivery data
 * - Sets initial status history entry
 * - Sets timeout timestamp
 * - Notifies nearby drivers
 */
export const onDeliveryCreate = onDocumentCreated(
  "deliveries/{deliveryId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.error("onDeliveryCreate: no data in event");
      return;
    }

    const deliveryId = event.params.deliveryId;
    const data = snapshot.data() as Partial<Delivery>;

    // Validate the delivery data
    const validation = validateDeliveryCreate(data);
    if (!validation.valid) {
      console.error(
        `Invalid delivery data for ${deliveryId}:`,
        validation.errors
      );
      // Mark as cancelled due to invalid data
      await snapshot.ref.update({
        status: "cancelled" as DeliveryStatus,
        statusHistory: [
          {
            status: "cancelled",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            actor: "system",
            note: `Auto-cancelled: ${validation.errors.join(", ")}`,
          },
        ],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Build initial status history
    const now = admin.firestore.Timestamp.now();
    const initialStatusEntry: StatusEntry = {
      status: "new",
      timestamp: now,
      actor: data.senderId ?? "system",
      note: "Delivery created",
    };

    // Calculate timeout
    const timeoutAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + DEFAULT_TIMEOUT_HOURS * 60 * 60 * 1000
    );

    // Lookup sender info for denormalization
    let senderName = "";
    let senderPhotoUrl = "";
    let senderRating: number | null = null;
    if (data.senderId) {
      const senderDoc = await admin.firestore().collection("users").doc(data.senderId).get();
      if (senderDoc.exists) {
        const s = senderDoc.data()!;
        senderName = s.nickname || s.fullName || "";
        senderPhotoUrl = s.profilePhotoURL || "";
        senderRating = s.ratingAsSender?.average ?? null;
      }
    }

    // Set default fields + sender info
    await snapshot.ref.update({
      status: "new" as DeliveryStatus,
      statusHistory: [initialStatusEntry],
      payment: { senderConfirmed: false, driverConfirmed: false },
      proof: {},
      senderName,
      senderPhotoUrl,
      senderRating,
      timeoutAt,
      createdAt: now,
      updatedAt: now,
    });

    // Notify nearby drivers
    try {
      const pickupGeohash = data.pickup?.geohash;
      if (pickupGeohash) {
        const nearbyDrivers = await getNearbyDriverTokens(
          pickupGeohash,
          15, // 15 km radius
          data.pickup?.lat,
          data.pickup?.lng
        );

        const pickupCity = data.pickup?.city ?? "";
        const destCity = data.destination?.city ?? "";
        const price = String(data.price ?? 0);

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
                price,
              }
            )
          )
        );

        console.log(
          `Notified ${nearbyDrivers.length} nearby drivers for delivery ${deliveryId}`
        );
      }
    } catch (error) {
      console.error("Failed to notify nearby drivers:", error);
      // Non-critical, don't fail the trigger
    }
  }
);

/**
 * Firestore onUpdate trigger for deliveries.
 * - Validates status transitions
 * - Updates statusHistory
 * - Triggers push notifications
 * - Handles payment confirmation logic
 */
export const onDeliveryUpdate = onDocumentUpdated(
  "deliveries/{deliveryId}",
  async (event) => {
    const change = event.data;
    if (!change) {
      console.error("onDeliveryUpdate: no data in event");
      return;
    }

    const deliveryId = event.params.deliveryId;
    const before = change.before.data() as Delivery;
    const after = change.after.data() as Delivery;

    // Detect status change
    if (before.status !== after.status) {
      await handleStatusChange(deliveryId, before, after, change.after.ref);
    }

    // Detect payment confirmation changes
    if (
      before.payment.senderConfirmed !== after.payment.senderConfirmed ||
      before.payment.driverConfirmed !== after.payment.driverConfirmed
    ) {
      await handlePaymentConfirmation(deliveryId, after, change.after.ref);
    }
  }
);

/**
 * Handle a delivery status change.
 */
async function handleStatusChange(
  deliveryId: string,
  before: Delivery,
  after: Delivery,
  ref: FirebaseFirestore.DocumentReference
): Promise<void> {
  const oldStatus = before.status;
  const newStatus = after.status;

  console.log(
    `Delivery ${deliveryId} status changed: ${oldStatus} -> ${newStatus}`
  );

  // Map status changes to notification events
  const statusToNotificationEvent: Partial<
    Record<DeliveryStatus, string>
  > = {
    pending: "driver_interested",
    waiting: "sender_approved",
    picked_up: "delivery_picked_up",
    delivered: "delivery_delivered",
    completed_paid: "payment_confirmed",
    cancelled: "delivery_cancelled",
  };

  const notificationEvent = statusToNotificationEvent[newStatus];
  if (notificationEvent) {
    try {
      await sendDeliveryNotification(
        deliveryId,
        notificationEvent as import("@mooviz/shared").NotificationEventType,
        {
          cancelledBy: after.cancelledBy ?? "unknown",
        }
      );
    } catch (error) {
      console.error(
        `Failed to send notification for delivery ${deliveryId}:`,
        error
      );
    }
  }

  // Create system message in chat
  const chatId = (after as any).chatId as string | undefined;
  if (chatId) {
    const systemMessages: Record<string, string> = {
      "pending": "\u{1F697} \u05E0\u05D4\u05D2 \u05D4\u05D1\u05D9\u05E2 \u05E2\u05E0\u05D9\u05D9\u05DF \u05D1\u05DE\u05E9\u05DC\u05D5\u05D7",
      "waiting": "\u2705 \u05D4\u05E0\u05D4\u05D2 \u05D0\u05D5\u05E9\u05E8 \u05DC\u05DE\u05E9\u05DC\u05D5\u05D7",
      "picked_up": "\u{1F4E6} \u05D4\u05E0\u05D4\u05D2 \u05D0\u05E1\u05E3 \u05D0\u05EA \u05D4\u05DE\u05E9\u05DC\u05D5\u05D7",
      "delivered": "\u{1F3E0} \u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D4\u05D2\u05D9\u05E2 \u05DC\u05D9\u05E2\u05D3",
      "completed_paid": "\u{1F4B0} \u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05D0\u05D5\u05E9\u05E8 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05E9\u05E0\u05D9 \u05D4\u05E6\u05D3\u05D3\u05D9\u05DD",
      "cancelled": "\u274C \u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D1\u05D5\u05D8\u05DC",
    };
    const systemMsg = systemMessages[newStatus];
    if (systemMsg) {
      try {
        await admin.firestore()
          .collection("chats").doc(chatId)
          .collection("messages").add({
            type: "system",
            text: systemMsg,
            senderId: "system",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: true,
          });
        // Update chat metadata
        await admin.firestore()
          .collection("chats").doc(chatId)
          .update({
            lastMessage: systemMsg,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSenderId: "system",
          });
      } catch (error) {
        console.error(
          `Failed to create system message for delivery ${deliveryId}:`,
          error
        );
      }
    }
  }
}

/**
 * Handle payment confirmation.
 * When both sender and driver confirm, transition to completed_paid.
 */
async function handlePaymentConfirmation(
  deliveryId: string,
  delivery: Delivery,
  ref: FirebaseFirestore.DocumentReference
): Promise<void> {
  if (
    delivery.payment.senderConfirmed &&
    delivery.payment.driverConfirmed &&
    delivery.status === "delivered"
  ) {
    console.log(
      `Both parties confirmed payment for delivery ${deliveryId}, completing...`
    );

    const now = admin.firestore.Timestamp.now();
    const completionEntry: StatusEntry = {
      status: "completed_paid",
      timestamp: now,
      actor: "system",
      note: "Both parties confirmed payment",
    };

    await ref.update({
      status: "completed_paid" as DeliveryStatus,
      statusHistory: admin.firestore.FieldValue.arrayUnion(completionEntry),
      updatedAt: now,
    });

    // Update completed deliveries count for both users
    const batch = db.batch();
    if (delivery.senderId) {
      batch.update(db.collection("users").doc(delivery.senderId), {
        completedDeliveries: admin.firestore.FieldValue.increment(1),
      });
    }
    if (delivery.driverId) {
      batch.update(db.collection("users").doc(delivery.driverId), {
        completedDeliveries: admin.firestore.FieldValue.increment(1),
      });
    }
    await batch.commit();
  }
}
