import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { User } from "@mooviz/shared";

const db = admin.firestore();

/**
 * Firestore onCreate trigger for users.
 * - Sets default values for new users
 * - Creates a welcome notification
 */
export const onUserCreate = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.error("onUserCreate: no data in event");
      return;
    }

    const userId = event.params.userId;
    const data = snapshot.data() as Partial<User>;

    const now = admin.firestore.Timestamp.now();

    // Set defaults for fields that may not have been provided
    const defaults: Record<string, unknown> = {};

    if (!(data as Record<string, unknown>).ratingAsDriver) {
      defaults.ratingAsDriver = { average: 0, count: 0 };
    }
    if (!(data as Record<string, unknown>).ratingAsSender) {
      defaults.ratingAsSender = { average: 0, count: 0 };
    }
    if (data.completedDeliveries === undefined) {
      defaults.completedDeliveries = 0;
    }
    if (!data.status) {
      defaults.status = "active";
    }
    if (!data.kycStatus) {
      defaults.kycStatus = "pending";
    }
    if (!(data as Record<string, unknown>).fcmTokens) {
      defaults.fcmTokens = [];
    }
    if (!data.profilePhotoURL) {
      defaults.profilePhotoURL = "";
    }
    if (!data.kycDocumentURL) {
      defaults.kycDocumentURL = "";
    }
    if (!(data as Record<string, unknown>).activeMode) {
      defaults.activeMode = "client";
    }
    if ((data as Record<string, unknown>).driverAvailable === undefined) {
      defaults.driverAvailable = false;
    }
    if ((data as Record<string, unknown>).driverUnlocked === undefined) {
      defaults.driverUnlocked = false;
    }
    if (!data.createdAt) {
      defaults.createdAt = now;
    }

    // Only update if there are defaults to set
    if (Object.keys(defaults).length > 0) {
      await snapshot.ref.update(defaults);
    }

    // Create a welcome notification in the notifications subcollection
    await db
      .collection("users")
      .doc(userId)
      .collection("notifications")
      .add({
        title: "Welcome to MOOVIZ!",
        titleHe: "!MOOVIZ-\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC",
        body:
          (data as Record<string, unknown>).activeMode === "driver"
            ? "Start accepting deliveries in your area. Complete your KYC verification to get started."
            : "Create your first delivery and connect with trusted drivers nearby.",
        bodyHe:
          (data as Record<string, unknown>).activeMode === "driver"
            ? ".\u05D4\u05EA\u05D7\u05D9\u05DC\u05D5 \u05DC\u05E7\u05D1\u05DC \u05DE\u05E9\u05DC\u05D5\u05D7\u05D9\u05DD \u05D1\u05D0\u05D6\u05D5\u05E8 \u05E9\u05DC\u05DB\u05DD. \u05D4\u05E9\u05DC\u05D9\u05DE\u05D5 \u05D0\u05EA \u05D0\u05D9\u05DE\u05D5\u05EA \u05D4-KYC \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC"
            : ".\u05E6\u05E8\u05D5 \u05D0\u05EA \u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF \u05E9\u05DC\u05DB\u05DD \u05D5\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5 \u05DC\u05E0\u05D4\u05D2\u05D9\u05DD \u05D0\u05DE\u05D9\u05E0\u05D9\u05DD \u05D1\u05E1\u05D1\u05D9\u05D1\u05D4",
        type: "system",
        read: false,
        createdAt: now,
      });

    console.log(`User ${userId} created with activeMode '${(data as Record<string, unknown>).activeMode || "client"}'`);
  }
);

/**
 * Firestore onUpdate trigger for users.
 * - Handles KYC status changes
 * - Sends appropriate notifications
 */
export const onUserUpdate = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const change = event.data;
    if (!change) {
      console.error("onUserUpdate: no data in event");
      return;
    }

    const userId = event.params.userId;
    const before = change.before.data() as User;
    const after = change.after.data() as User;

    // Handle KYC status change
    if (before.kycStatus !== after.kycStatus) {
      await handleKycStatusChange(userId, before.kycStatus, after.kycStatus);
    }

    // Handle account status change
    if (before.status !== after.status) {
      await handleAccountStatusChange(userId, before.status, after.status);
    }
  }
);

/**
 * Handle KYC status changes and notify the user.
 */
async function handleKycStatusChange(
  userId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  console.log(`User ${userId} KYC status: ${oldStatus} -> ${newStatus}`);

  const now = admin.firestore.Timestamp.now();
  let title: string;
  let body: string;
  let titleHe: string;
  let bodyHe: string;

  switch (newStatus) {
    case "approved":
      title = "KYC Approved!";
      titleHe = "!KYC \u05D0\u05D5\u05E9\u05E8";
      body = "Your identity verification has been approved. You can now use all platform features.";
      bodyHe = ".\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05D6\u05D4\u05D5\u05EA \u05E9\u05DC\u05DA \u05D0\u05D5\u05E9\u05E8. \u05DB\u05E2\u05EA \u05EA\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05DB\u05DC \u05EA\u05DB\u05D5\u05E0\u05D5\u05EA \u05D4\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05D4";
      break;
    case "rejected":
      title = "KYC Verification Rejected";
      titleHe = "KYC \u05D0\u05D9\u05DE\u05D5\u05EA \u05E0\u05D3\u05D7\u05D4";
      body = "Your identity verification was not approved. Please resubmit your documents.";
      bodyHe = ".\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05D6\u05D4\u05D5\u05EA \u05E9\u05DC\u05DA \u05DC\u05D0 \u05D0\u05D5\u05E9\u05E8\u05D4. \u05D0\u05E0\u05D0 \u05D4\u05D2\u05D9\u05E9\u05D5 \u05DE\u05D7\u05D3\u05E9 \u05D0\u05EA \u05D4\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD";
      break;
    default:
      return; // No notification for 'pending'
  }

  await db
    .collection("users")
    .doc(userId)
    .collection("notifications")
    .add({
      title,
      titleHe,
      body,
      bodyHe,
      type: "system",
      read: false,
      createdAt: now,
    });
}

/**
 * Handle account status changes (active/suspended/blocked).
 */
async function handleAccountStatusChange(
  userId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  console.log(`User ${userId} account status: ${oldStatus} -> ${newStatus}`);

  if (newStatus === "suspended" || newStatus === "blocked") {
    const now = admin.firestore.Timestamp.now();
    await db
      .collection("users")
      .doc(userId)
      .collection("notifications")
      .add({
        title: newStatus === "suspended" ? "Account Suspended" : "Account Blocked",
        titleHe: newStatus === "suspended" ? "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05D4\u05D5\u05E9\u05E2\u05D4" : "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E0\u05D7\u05E1\u05DD",
        body: `Your account has been ${newStatus}. Please contact support for more information.`,
        bodyHe: `.\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA ${newStatus === "suspended" ? "\u05D4\u05D5\u05E9\u05E2\u05D4" : "\u05E0\u05D7\u05E1\u05DD"}. \u05E6\u05E8\u05D5 \u05E7\u05E9\u05E8 \u05E2\u05DD \u05D4\u05EA\u05DE\u05D9\u05DB\u05D4 \u05DC\u05DE\u05D9\u05D3\u05E2 \u05E0\u05D5\u05E1\u05E3`,
        type: "system",
        read: false,
        createdAt: now,
      });
  }
}
