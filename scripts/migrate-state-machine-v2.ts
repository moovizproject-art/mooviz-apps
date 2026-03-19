/**
 * One-time migration: rename 'waiting' → 'waiting_for_pickup' in all active deliveries.
 * Also updates statusHistory entries.
 * Run AFTER deploying functions (they accept new statuses).
 * Run BEFORE deploying mobile APK (it sends new statuses).
 *
 * Usage: npx ts-node scripts/migrate-state-machine-v2.ts
 */
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

async function migrate() {
  console.log("Starting state machine v2 migration...");

  // Find all deliveries with status 'waiting'
  const waitingDocs = await db
    .collection("deliveries")
    .where("status", "==", "waiting")
    .get();

  console.log(`Found ${waitingDocs.size} deliveries with status 'waiting'`);

  let count = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of waitingDocs.docs) {
    const data = doc.data();
    const now = admin.firestore.Timestamp.now();

    const updateData: Record<string, unknown> = {
      status: "waiting_for_pickup",
      updatedAt: now,
    };

    // Update statusHistory: rename 'waiting' entries to 'waiting_for_pickup'
    if (Array.isArray(data.statusHistory)) {
      updateData.statusHistory = data.statusHistory.map((entry: any) => ({
        ...entry,
        status: entry.status === "waiting" ? "waiting_for_pickup" : entry.status,
      }));
    }

    batch.update(doc.ref, updateData);
    count++;
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`Committed ${count} updates...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Migration complete: ${count} deliveries updated`);
  console.log("\nNote: 'matched' and 'in_transit' never existed in Firestore — no migration needed for those.");
}

migrate().catch(console.error).then(() => process.exit(0));
