import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  DeliveryStatus,
  StatusEntry,
  TIMEOUT_ELIGIBLE_STATUSES,
} from "@mooviz/shared";
import { sendDeliveryNotification } from "../services/notificationService";
import { logger } from "../utils/logger";

const db = admin.firestore();

/**
 * Scheduled function that runs every hour.
 * Finds deliveries in 'new' or 'pending' status that have passed their timeoutAt
 * and cancels them automatically.
 */
export const timeoutCleanup = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "Asia/Jerusalem",
    retryCount: 3,
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    logger.info("Running timeout cleanup", { timestamp: now.toDate().toISOString() });

    let totalProcessed = 0;
    let totalCancelled = 0;
    let totalReverted = 0;

    // Collect deliveries cancelled by timeout so we can notify senders after batch commit
    const expiredToNotify: Array<{
      deliveryId: string;
      senderId: string;
      price: number;
      pickupCity: string;
      destinationCity: string;
    }> = [];

    for (const status of TIMEOUT_ELIGIBLE_STATUSES) {
      const snapshot = await db
        .collection("deliveries")
        .where("status", "==", status)
        .where("timeoutAt", "<=", now)
        .limit(500) // Process in batches to avoid timeout
        .get();

      if (snapshot.empty) {
        logger.info("No timed-out deliveries for status", { status });
        continue;
      }

      logger.info("Found timed-out deliveries", { status, count: snapshot.size });

      // Use batched writes for efficiency
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let operationCount = 0;

      for (const doc of snapshot.docs) {
        const delivery = doc.data();

        // Safety: skip if already cancelled or completed (race condition guard)
        if (delivery.status === "cancelled" || delivery.status === "completed_paid") {
          continue;
        }

        totalProcessed++;

        const statusEntry: StatusEntry = {
          status: "cancelled",
          timestamp: now,
          actor: "system",
          note: `Auto-cancelled: delivery timed out in '${status}' status`,
        };

        if (status === "pending" && delivery.driverId) {
          // For pending deliveries with a driver, revert to 'new' so other
          // drivers can express interest
          const revertEntry: StatusEntry = {
            status: "new",
            timestamp: now,
            actor: "system",
            note: "Reverted: driver interest timed out",
          };

          // Set a new timeout for the reverted delivery
          const newTimeoutAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + 24 * 60 * 60 * 1000
          );

          currentBatch.update(doc.ref, {
            status: "new" as DeliveryStatus,
            driverId: admin.firestore.FieldValue.delete(),
            statusHistory: admin.firestore.FieldValue.arrayUnion(revertEntry),
            timeoutAt: newTimeoutAt,
            updatedAt: now,
          });

          totalReverted++;
        } else {
          // Cancel the delivery
          currentBatch.update(doc.ref, {
            status: "cancelled" as DeliveryStatus,
            statusHistory: admin.firestore.FieldValue.arrayUnion(statusEntry),
            cancelledBy: "system",
            updatedAt: now,
          });

          // Queue expiry notification for the sender (only when no driver was assigned)
          if (delivery.senderId) {
            expiredToNotify.push({
              deliveryId: doc.id,
              senderId: delivery.senderId,
              price: delivery.price ?? delivery.suggestedPrice ?? 0,
              pickupCity: delivery.pickup?.city ?? "",
              destinationCity: delivery.destination?.city ?? "",
            });
          }

          totalCancelled++;
        }

        operationCount++;

        // Firestore batch limit is 500 operations
        if (operationCount >= 499) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }
      }

      // Push the last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Commit all batches
      await Promise.all(batches.map((batch) => batch.commit()));
    }

    logger.info("Timeout cleanup complete", { totalProcessed, totalCancelled, totalReverted });

    // Send expiry notifications — fire-and-forget, don't block cleanup on FCM failures
    for (const expired of expiredToNotify) {
      sendDeliveryNotification(
        expired.deliveryId,
        "delivery_expired",
        {
          pickupCity: expired.pickupCity,
          destinationCity: expired.destinationCity,
          price: String(expired.price),
        }
      ).catch((err) =>
        logger.error("timeoutCleanup: delivery_expired notification failed", {
          deliveryId: expired.deliveryId,
          error: String(err),
        })
      );
    }

    // awaiting_payment timeout: 48h → send reminder; 72h → auto-complete
    const awaitingPaymentQuery = db
      .collection("deliveries")
      .where("status", "==", "awaiting_payment")
      .where("updatedAt", "<=", admin.firestore.Timestamp.fromMillis(
        Date.now() - 48 * 60 * 60 * 1000
      ));

    const awaitingPaymentDocs = await awaitingPaymentQuery.get();
    for (const doc of awaitingPaymentDocs.docs) {
      const data = doc.data();
      // Safety: skip if status changed between query and processing
      if (data.status !== "awaiting_payment") continue;
      const updatedMs = data.updatedAt?.toMillis?.() ?? 0;
      const hoursWaiting = Math.floor((Date.now() - updatedMs) / (60 * 60 * 1000));

      if (hoursWaiting >= 72) {
        const autoCompleteNow = admin.firestore.Timestamp.now();
        await db.runTransaction(async (txn) => {
          const fresh = await txn.get(doc.ref);
          if (fresh.data()?.status !== "awaiting_payment") return;

          txn.update(doc.ref, {
            status: "completed_paid" as DeliveryStatus,
            "payment.senderConfirmed": true,
            "payment.driverConfirmed": true,
            statusHistory: admin.firestore.FieldValue.arrayUnion({
              status: "completed_paid",
              timestamp: autoCompleteNow,
              actor: "system",
              note: `Auto-completed: payment awaiting for ${hoursWaiting}h`,
            } as StatusEntry),
            updatedAt: autoCompleteNow,
          });

          if (fresh.data()?.senderId) {
            txn.update(db.collection("users").doc(fresh.data()!.senderId), {
              completedDeliveries: admin.firestore.FieldValue.increment(1),
            });
          }
          if (fresh.data()?.driverId) {
            txn.update(db.collection("users").doc(fresh.data()!.driverId), {
              completedDeliveries: admin.firestore.FieldValue.increment(1),
            });
          }
        });
        logger.info("timeoutCleanup: auto-completed awaiting_payment", { deliveryId: doc.id, hoursWaiting });
      } else {
        // 48h+ but <72h: send reminder notification
        try {
          const { sendDeliveryNotification } = require("../services/notificationService");
          await sendDeliveryNotification(doc.id, "payment_reminder", {
            hoursWaiting: String(hoursWaiting),
          });
        } catch (err) {
          logger.error("timeoutCleanup: payment reminder failed", { deliveryId: doc.id, error: String(err) });
        }
        logger.info("timeoutCleanup: sent payment reminder", { deliveryId: doc.id, hoursWaiting });
      }
    }
  }
);
