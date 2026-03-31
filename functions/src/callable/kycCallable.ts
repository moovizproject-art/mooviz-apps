import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const db = admin.firestore();

/**
 * Admin-only: Review a user's KYC submission.
 */
export const reviewKYC = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  // Verify caller is admin
  const adminDoc = await db.collection("users").doc(adminUid).get();
  if (!adminDoc.exists || adminDoc.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const { userId, decision, reason } = request.data;

  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "userId is required");
  }
  if (decision !== "approved" && decision !== "rejected") {
    throw new HttpsError("invalid-argument", "decision must be 'approved' or 'rejected'");
  }
  if (decision === "rejected" && (!reason || typeof reason !== "string")) {
    throw new HttpsError("invalid-argument", "reason is required for rejection");
  }

  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const now = admin.firestore.Timestamp.now();

  // Update user KYC status.
  // When approved: unlock driver mode AND enable availability + set role,
  // so the driver immediately appears in proximity queries for push notifications.
  const isApproved = decision === "approved";
  const update: Record<string, unknown> = {
    kycStatus: decision,
    driverUnlocked: isApproved,
    updatedAt: now,
    ...(isApproved && { driverAvailable: true, role: "driver" }),
  };

  await userRef.update(update);

  // Log admin action
  await db.collection("adminActions").add({
    adminId: adminUid,
    action: "kyc_review",
    targetUserId: userId,
    decision,
    reason: reason || null,
    timestamp: now,
  });

  return { success: true, message: `KYC ${decision} for user ${userId}` };
});
