import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as crypto from "crypto";

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Server secret — MUST be set via environment/Secret Manager
// Deferred check: throws only when an encryption function is called, not at module load
const SERVER_SECRET = process.env.ENCRYPTION_SECRET as string;

function getSecret(): string {
  if (!SERVER_SECRET) {
    throw new Error(
      "ENCRYPTION_SECRET environment variable is required. Set it via Firebase Secret Manager."
    );
  }
  return SERVER_SECRET;
}

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

// ─── Key Derivation ──────────────────────────────────────────────

/**
 * Derive a deterministic AES-256 key for a given user.
 */
function deriveKey(uid: string): Buffer {
  return crypto
    .createHmac("sha256", getSecret())
    .update(uid)
    .digest(); // 32 bytes = AES-256
}

/**
 * Encrypt a buffer with AES-256-CBC.
 * Returns a buffer: [IV (16 bytes) | ciphertext].
 */
function encryptBuffer(data: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypt a buffer encrypted with encryptBuffer.
 */
function decryptBuffer(data: Buffer, key: Buffer): Buffer {
  const iv = data.subarray(0, IV_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ─── Cloud Functions ─────────────────────────────────────────────

/**
 * Upload and encrypt a profile photo.
 *
 * Client uploads the raw image to `users/{uid}/profile-temp.jpg`,
 * then calls this function. We encrypt the file, store as
 * `users/{uid}/profile.enc`, delete the temp, and update Firestore.
 */
export const uploadProfilePhoto = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const tempPath = `users/${uid}/profile-temp.jpg`;
  const encPath = `users/${uid}/profile.enc`;

  // Download the temp file
  const tempFile = bucket.file(tempPath);
  const [exists] = await tempFile.exists();
  if (!exists) {
    throw new HttpsError(
      "not-found",
      "Upload the image to users/{uid}/profile-temp.jpg first"
    );
  }

  const [rawBuffer] = await tempFile.download();

  // Validate size (5MB max)
  if (rawBuffer.length > 5 * 1024 * 1024) {
    await tempFile.delete();
    throw new HttpsError("invalid-argument", "Image must be under 5MB");
  }

  // Encrypt
  const key = deriveKey(uid);
  const encrypted = encryptBuffer(rawBuffer, key);

  // Upload encrypted file
  const encFile = bucket.file(encPath);
  await encFile.save(encrypted, {
    metadata: {
      contentType: "application/octet-stream",
      metadata: {
        encrypted: "true",
        originalContentType: "image/jpeg",
        ownerId: uid,
      },
    },
  });

  // Delete temp file
  await tempFile.delete();

  // Update Firestore — store storage path (NOT a download URL)
  await db.collection("users").doc(uid).update({
    profilePhotoPath: encPath,
    profilePhotoUpdatedAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  return { success: true, storagePath: encPath };
});

/**
 * Get an authorized profile photo as base64.
 *
 * Authorization rules:
 * 1. Owner — always allowed
 * 2. Matched driver — delivery exists where senderId == targetUser
 *    AND driverId == caller AND status >= 'waiting_for_pickup'
 * 3. Admin — always allowed
 *
 * Before matching, drivers see a silhouette (client handles this
 * by showing AvatarCircle initials when no photo data returned).
 */
export const getAuthorizedPhoto = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { targetUserId } = request.data;
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new HttpsError("invalid-argument", "targetUserId is required");
  }

  // ── Authorization check ──
  let authorized = false;

  // 1. Self
  if (callerUid === targetUserId) {
    authorized = true;
  }

  // 2. Admin
  if (!authorized) {
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (callerDoc.exists && callerDoc.data()?.role === "admin") {
      authorized = true;
    }
  }

  // 3. Matched driver — check if there's a delivery linking these users
  if (!authorized) {
    // Caller is driver, target is sender
    const asDriverQuery = await db
      .collection("deliveries")
      .where("driverId", "==", callerUid)
      .where("senderId", "==", targetUserId)
      .where("status", "in", [
        "awaiting_confirm",
        "waiting_for_pickup",
        "picked_up",
        "delivered",
        "awaiting_payment",
        "completed_paid",
      ])
      .limit(1)
      .get();

    if (!asDriverQuery.empty) {
      authorized = true;
    }
  }

  // 4. Caller is sender, target is driver — also allowed after matching
  if (!authorized) {
    const asSenderQuery = await db
      .collection("deliveries")
      .where("senderId", "==", callerUid)
      .where("driverId", "==", targetUserId)
      .where("status", "in", [
        "awaiting_confirm",
        "waiting_for_pickup",
        "picked_up",
        "delivered",
        "awaiting_payment",
        "completed_paid",
      ])
      .limit(1)
      .get();

    if (!asSenderQuery.empty) {
      authorized = true;
    }
  }

  if (!authorized) {
    // Not an error — just means "show silhouette"
    return { authorized: false, photoData: null };
  }

  // ── Fetch and decrypt ──
  const targetDoc = await db.collection("users").doc(targetUserId).get();
  if (!targetDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const profilePhotoPath = targetDoc.data()?.profilePhotoPath;
  if (!profilePhotoPath) {
    // User has no photo uploaded
    return { authorized: true, photoData: null };
  }

  const file = bucket.file(profilePhotoPath);
  const [fileExists] = await file.exists();
  if (!fileExists) {
    return { authorized: true, photoData: null };
  }

  const [encryptedBuffer] = await file.download();
  const key = deriveKey(targetUserId);

  try {
    const decrypted = decryptBuffer(encryptedBuffer, key);
    const base64 = decrypted.toString("base64");
    return {
      authorized: true,
      photoData: `data:image/jpeg;base64,${base64}`,
    };
  } catch (err) {
    console.error(
      `[getAuthorizedPhoto] Decryption failed for ${targetUserId}:`,
      err
    );
    throw new HttpsError("internal", "Failed to decrypt photo");
  }
});

// getEncryptionKey endpoint REMOVED — encryption keys must never leave the server.
// All encryption/decryption happens server-side only.

/**
 * Admin-only: Decrypt a document at a given storage path.
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

  const { storagePath, ownerId } = request.data;
  if (!storagePath || typeof storagePath !== "string") {
    throw new HttpsError("invalid-argument", "storagePath is required");
  }
  if (!ownerId || typeof ownerId !== "string") {
    throw new HttpsError("invalid-argument", "ownerId is required");
  }

  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError("not-found", "File not found");
  }

  const [encryptedBuffer] = await file.download();
  const key = deriveKey(ownerId);

  try {
    const decrypted = decryptBuffer(encryptedBuffer, key);
    const base64 = decrypted.toString("base64");
    const [metadata] = await file.getMetadata();
    const contentType =
      metadata.metadata?.originalContentType || "application/octet-stream";

    return {
      data: `data:${contentType};base64,${base64}`,
    };
  } catch (err) {
    console.error(`[decryptDocument] Decryption failed for ${storagePath}:`, err);
    throw new HttpsError("internal", "Failed to decrypt document");
  }
});
