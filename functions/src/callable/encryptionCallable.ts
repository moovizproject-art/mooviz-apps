import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as crypto from "crypto";

const db = admin.firestore();

// Server secret — in production, use Firebase Functions config or Secret Manager
const SERVER_SECRET = process.env.ENCRYPTION_SECRET || "mooviz-dev-encryption-key-change-in-production";

/**
 * Get a per-user encryption key derived from UID + server secret.
 * Only the document owner or admin can request this.
 */
export const getEncryptionKey = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { targetUserId } = request.data;
  const uid = targetUserId || callerUid;

  // Only allow self or admin
  if (uid !== callerUid) {
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Cannot access other user's encryption key");
    }
  }

  // Derive key from UID + server secret
  const key = crypto
    .createHmac("sha256", SERVER_SECRET)
    .update(uid)
    .digest("hex");

  return { key: key.substring(0, 32) }; // AES-256 needs 32 bytes
});

/**
 * Admin-only: Decrypt a document and return a signed URL.
 */
export const decryptDocument = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const adminDoc = await db.collection("users").doc(adminUid).get();
  if (!adminDoc.exists || adminDoc.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const { storagePath } = request.data;
  if (!storagePath || typeof storagePath !== "string") {
    throw new HttpsError("invalid-argument", "storagePath is required");
  }

  // For now, return a signed URL directly (encryption not yet applied)
  // TODO: Implement actual decryption when client-side encryption is active
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });

  return { url: signedUrl };
});
