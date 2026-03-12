import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

const db = admin.firestore();
const authAdmin = admin.auth();

/** Emails to KEEP — everything else gets deleted */
const KEEP_EMAILS = [
  "tamir.konor@gmail.com",
  "admin@mooviz.co.il",
  "tamir@k-a-l.solutions",
  "niv@kal.solutions",
  "niv@kal-trade.com",
];

/**
 * One-time fix: Delete all users from Firebase Auth + Firestore
 * except the preserved list above.
 * HTTP endpoint — DELETE AFTER USE.
 *
 * GET  → dry run (shows who would be deleted)
 * POST → actually deletes
 */
export const purgeTestUsers = onRequest(async (req, res) => {
  const dryRun = req.method === "GET";

  // 1. List all Auth users
  const toDelete: { uid: string; email: string | undefined }[] = [];
  let nextPageToken: string | undefined;
  do {
    const listResult = await authAdmin.listUsers(1000, nextPageToken);
    for (const user of listResult.users) {
      const email = (user.email || "").toLowerCase();
      const keep = KEEP_EMAILS.some((e) => email === e.toLowerCase());
      if (!keep) {
        toDelete.push({ uid: user.uid, email: user.email });
      }
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  if (dryRun) {
    res.json({
      dryRun: true,
      wouldDelete: toDelete.length,
      users: toDelete,
      kept: KEEP_EMAILS,
    });
    return;
  }

  // 2. Delete from Firebase Auth (batch of 1000)
  const uids = toDelete.map((u) => u.uid);
  let authDeleted = 0;
  for (let i = 0; i < uids.length; i += 1000) {
    const batch = uids.slice(i, i + 1000);
    const result = await authAdmin.deleteUsers(batch);
    authDeleted += result.successCount;
  }

  // 3. Delete Firestore user docs + subcollections
  const BATCH_SIZE = 500;
  let firestoreBatch = db.batch();
  let fsCount = 0;
  for (const { uid } of toDelete) {
    firestoreBatch.delete(db.collection("users").doc(uid));
    fsCount++;
    if (fsCount % BATCH_SIZE === 0) {
      await firestoreBatch.commit();
      firestoreBatch = db.batch();
    }
  }
  if (fsCount % BATCH_SIZE !== 0) {
    await firestoreBatch.commit();
  }

  // 4. Clean up deliveries, chats, ratings by deleted users
  const deletedUids = new Set(uids);
  const collections = ["deliveries", "chats", "ratings", "reports"];
  const extraDeleted: Record<string, number> = {};

  for (const col of collections) {
    let colBatch = db.batch();
    let colCount = 0;
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const ownerField = col === "deliveries" ? "senderId" : col === "chats" ? "participants" : "userId";
      const owner = data[ownerField];
      // For chats, check if ALL participants are deleted
      const shouldDelete = Array.isArray(owner)
        ? owner.every((p: string) => deletedUids.has(p))
        : deletedUids.has(owner);
      if (shouldDelete) {
        colBatch.delete(doc.ref);
        colCount++;
        if (colCount % BATCH_SIZE === 0) {
          await colBatch.commit();
          colBatch = db.batch();
        }
      }
    }
    if (colCount % BATCH_SIZE !== 0) {
      await colBatch.commit();
    }
    extraDeleted[col] = colCount;
  }

  res.json({
    success: true,
    authDeleted,
    firestoreUsersDeleted: fsCount,
    extraDeleted,
    kept: KEEP_EMAILS,
  });
});
