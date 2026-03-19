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
import { sendDeliveryNotification, sendPushNotification } from "../services/notificationService";
import { getNearbyDriverTokensMultiLocation } from "../services/geohashService";

const db = admin.firestore();

/**
 * Convert any timestamp format to a Firestore Timestamp.
 * Handles: Firestore Timestamp, plain {seconds, nanoseconds}, ISO strings, Date objects.
 */
function toFirestoreTimestamp(ts: unknown): admin.firestore.Timestamp {
  if (!ts) return admin.firestore.Timestamp.now();
  if (ts instanceof admin.firestore.Timestamp) return ts;
  if (typeof ts === "object" && ts !== null && "seconds" in ts) {
    const obj = ts as { seconds: number; nanoseconds?: number };
    return new admin.firestore.Timestamp(obj.seconds, obj.nanoseconds ?? 0);
  }
  if (typeof ts === "string") {
    const ms = Date.parse(ts);
    if (!isNaN(ms)) return admin.firestore.Timestamp.fromMillis(ms);
  }
  if (ts instanceof Date) return admin.firestore.Timestamp.fromDate(ts);
  return admin.firestore.Timestamp.now();
}

/**
 * Normalize statusHistory entries — ensures all timestamps are proper Firestore Timestamps.
 */
function normalizeStatusHistory(
  entries: unknown[]
): StatusEntry[] {
  return entries.map((entry: any) => {
    const normalized: Record<string, unknown> = {
      status: entry.status ?? "new",
      timestamp: toFirestoreTimestamp(entry.timestamp),
      actor: entry.actor ?? entry.updatedBy ?? "system",
    };
    // Firestore Admin SDK rejects undefined — only include note if it has a value
    if (entry.note !== undefined && entry.note !== null) {
      normalized.note = entry.note;
    }
    return normalized as unknown as StatusEntry;
  });
}

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

    // Skip if already fully initialized by the createDelivery callable
    if (data.timeoutAt) {
      console.log(`onDeliveryCreate: ${deliveryId} already initialized by callable — skipping`);
      return;
    }

    // Validate the delivery data
    const validation = validateDeliveryCreate(data);
    if (!validation.valid) {
      console.error(
        `Invalid delivery data for ${deliveryId}:`,
        validation.errors
      );
      // Mark as cancelled due to invalid data
      const cancelNow = admin.firestore.Timestamp.now();
      await snapshot.ref.update({
        status: "cancelled" as DeliveryStatus,
        statusHistory: [
          {
            status: "cancelled",
            timestamp: cancelNow,
            actor: "system",
            note: `Auto-cancelled: ${validation.errors.join(", ")}`,
          },
        ],
        updatedAt: cancelNow,
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

    // Notify nearby drivers (multi-location: live GPS + home + work addresses)
    try {
      const pickup = data.pickup as Record<string, unknown> | undefined;
      const dest = data.destination as Record<string, unknown> | undefined;
      const pickupGeohash = pickup?.geohash as string | undefined;
      // Accept both lat/lng (HLD) and latitude/longitude (mobile)
      const pickupLat = (pickup?.lat ?? pickup?.latitude) as number | undefined;
      const pickupLng = (pickup?.lng ?? pickup?.longitude) as number | undefined;

      const initialRadius = 15; // km
      const notifiedDriverUids: string[] = [];

      if (pickupGeohash && pickupLat && pickupLng) {
        const itemSize = (data as any).item?.size as string | undefined;
        const nearbyDrivers = await getNearbyDriverTokensMultiLocation(
          pickupGeohash,
          initialRadius,
          pickupLat,
          pickupLng,
          undefined,
          itemSize
        );

        const pickupCity = (pickup?.city ?? "") as string;
        const destCity = (dest?.city ?? "") as string;
        const price = String((data as any).suggestedPrice ?? data.price ?? 0);

        await Promise.all(
          nearbyDrivers.map((driver) => {
            notifiedDriverUids.push(driver.uid);
            return sendPushNotification(
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
            );
          })
        );

        console.log(
          `Notified ${nearbyDrivers.length} nearby drivers for delivery ${deliveryId}`
        );
      }

      // Set expansion tracking fields for widening-net notifications
      await snapshot.ref.update({
        notifiedDrivers: notifiedDriverUids,
        notifyRadius: initialRadius,
        notifyExpansionCount: 0,
        lastNotifyExpansion: admin.firestore.Timestamp.now(),
      });
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

    // Normalize statusHistory if any entries have non-Timestamp values.
    // We continue processing after normalization because the re-trigger from
    // this write will have identical before/after for status and payment fields,
    // so the guards below will correctly skip duplicate processing.
    const rawHistory = (after as any).statusHistory;
    if (Array.isArray(rawHistory) && rawHistory.some(
      (e: any) => e.timestamp && typeof e.timestamp === "string"
    )) {
      await change.after.ref.update({
        statusHistory: normalizeStatusHistory(rawHistory),
      });
    }

    // Detect status change — validate transition server-side
    if (before.status !== after.status) {
      // validateStatusTransition checks both allowed transitions and actor roles
      // Using "system" role here since we can't determine actor from trigger context
      const isValid = validateStatusTransition(before.status, after.status, "system");
      if (!isValid) {
        // REVERT invalid transition — defense against direct client writes
        console.warn(
          `[onDeliveryUpdate] REVERTED invalid transition ${before.status} → ${after.status} on ${deliveryId}`
        );
        await change.after.ref.update({ status: before.status });
        return;
      }
      await handleStatusChange(deliveryId, before, after, change.after.ref);
    }

    // Payment confirmation handling moved to confirmPayment callable (v2 state machine).
    // The callable now manages delivered → awaiting_payment → completed_paid transitions.
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
  // NOTE: Notifications for statuses handled by callable functions
  // (pending, waiting, picked_up, delivered, cancelled) are sent there
  // to avoid duplicates and to have correct context (actor name, etc.).
  // The trigger only sends for completed_paid (fired by payment logic).
  const triggerOnlyEvents: Partial<
    Record<DeliveryStatus, string>
  > = {
    completed_paid: "payment_confirmed",
  };

  const notificationEvent = triggerOnlyEvents[newStatus];
  if (notificationEvent) {
    try {
      await sendDeliveryNotification(
        deliveryId,
        notificationEvent as import("@mooviz/shared").NotificationEventType,
        {}
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
      "pending": "\u{1F697} נהג הביע עניין במשלוח",
      "awaiting_confirm": "\u{1F446} השולח בחר נהג — ממתין לאישור הנהג",
      "waiting_for_pickup": "\u2705 הנהג אושר למשלוח",
      "picked_up": "\u{1F4E6} הנהג אסף את המשלוח",
      "delivered": "\u{1F3E0} המשלוח הגיע ליעדו",
      "awaiting_payment": "\u{1F4B3} צד אחד אישר תשלום — ממתין לצד השני",
      "completed_paid": "\u{1F4B0} התשלום אושר על ידי שני הצדדים",
      "cancelled": "\u274C המשלוח בוטל",
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
        // Update chat metadata — mark system messages as read by both participants
        // so they don't trigger unread badges
        const now = admin.firestore.Timestamp.now();
        const chatUpdate: Record<string, unknown> = {
          lastMessage: systemMsg,
          lastMessageAt: now,
          lastSenderId: "system",
        };
        // Stamp lastReadBy for both parties so system messages don't show as unread
        if (after.senderId) {
          chatUpdate[`lastReadBy.${after.senderId}`] = now;
        }
        if (after.driverId) {
          chatUpdate[`lastReadBy.${after.driverId}`] = now;
        }

        // Set chat auto-close timer based on status:
        // - delivered: 90 minutes after delivery
        // - completed_paid: 20 minutes after both payments confirmed
        if (newStatus === "delivered") {
          const closeAt = admin.firestore.Timestamp.fromMillis(
            Date.now() + 90 * 60 * 1000 // 90 minutes
          );
          chatUpdate.chatCloseAt = closeAt;
          chatUpdate.closed = false;
        }
        if (newStatus === "awaiting_payment") {
          const closeAt = admin.firestore.Timestamp.fromMillis(
            Date.now() + 48 * 60 * 60 * 1000 // 48 hours
          );
          chatUpdate.chatCloseAt = closeAt;
          chatUpdate.closed = false;
        }
        if (newStatus === "completed_paid") {
          const closeAt = admin.firestore.Timestamp.fromMillis(
            Date.now() + 20 * 60 * 1000 // 20 minutes
          );
          chatUpdate.chatCloseAt = closeAt;
          chatUpdate.closed = false;
        }

        // If delivery is cancelled, close chat immediately
        if (newStatus === "cancelled") {
          chatUpdate.closed = true;
          chatUpdate.closedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        await admin.firestore()
          .collection("chats").doc(chatId)
          .update(chatUpdate);
      } catch (error) {
        console.error(
          `Failed to create system message for delivery ${deliveryId}:`,
          error
        );
      }
    }
  }
}

// handlePaymentConfirmation removed — payment flow is now managed entirely by the
// confirmPayment callable (v2 state machine: delivered → awaiting_payment → completed_paid).
