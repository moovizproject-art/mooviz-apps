import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  DeliveryStatus,
  StatusEntry,
  TIMEOUT_ELIGIBLE_STATUSES,
} from "@mooviz/shared";

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

    console.log(`Running timeout cleanup at ${now.toDate().toISOString()}`);

    let totalProcessed = 0;
    let totalCancelled = 0;
    let totalReverted = 0;

    for (const status of TIMEOUT_ELIGIBLE_STATUSES) {
      const snapshot = await db
        .collection("deliveries")
        .where("status", "==", status)
        .where("timeoutAt", "<=", now)
        .limit(500) // Process in batches to avoid timeout
        .get();

      if (snapshot.empty) {
        console.log(`No timed-out deliveries with status '${status}'`);
        continue;
      }

      console.log(
        `Found ${snapshot.size} timed-out deliveries with status '${status}'`
      );

      // Use batched writes for efficiency
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let operationCount = 0;

      for (const doc of snapshot.docs) {
        const delivery = doc.data();
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

    console.log(
      `Timeout cleanup complete: ${totalProcessed} processed, ` +
        `${totalCancelled} cancelled, ${totalReverted} reverted to 'new'`
    );
  }
);
