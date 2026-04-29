import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";
import { User } from "@mooviz/shared";
import { sendPushNotification } from "../services/notificationService";
import { logger } from "../utils/logger";

const db = admin.firestore();
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");

/**
 * Firestore onCreate trigger for users.
 * - Sets default values for new users
 * - Creates a welcome notification
 */
export const onUserCreate = onDocumentCreated(
  { document: "users/{userId}", secrets: [smtpUser, smtpPass] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.error("onUserCreate: no data in event");
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
    if (!(data as Record<string, unknown>).fcmTokens) {
      defaults.fcmTokens = [];
    }
    if (!data.profilePhotoURL) {
      defaults.profilePhotoURL = "";
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

    // Enforce: kycStatus is only meaningful when docs are submitted.
    // Old app versions write kycStatus='pending' at registration with no docs.
    // Remove it so the admin KYC filter only shows real submissions.
    const hasKycDoc = !!(data as Record<string, unknown>).kycDocumentURL;
    if (data.kycStatus === "pending" && !hasKycDoc) {
      defaults.kycStatus = admin.firestore.FieldValue.delete();
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

    logger.info("User created", { userId, activeMode: (data as Record<string, unknown>).activeMode || "client" });

    // BCC support@mooviz.co.il on every new registration
    try {
      const isFromOldSystem = !!(data as Record<string, unknown>).migratedFromGlide;
      const fullName = ((data as Record<string, unknown>).fullName as string) || "לא צוין";
      const phone = ((data as Record<string, unknown>).phone as string) || "לא צוין";
      const email = ((data as Record<string, unknown>).email as string) || "לא צוין";
      const activeMode = ((data as Record<string, unknown>).activeMode as string) || "client";

      const transporter = nodemailer.createTransport({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
        auth: { user: smtpUser.value(), pass: smtpPass.value() },
      });

      await transporter.sendMail({
        from: `Mooviz Social Deliveries <${smtpUser.value()}>`,
        to: "support@mooviz.co.il",
        subject: `🆕 משתמש חדש נרשם — ${fullName}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #1a73e8;">משתמש חדש נרשם למערכת</h2>
            <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold;">שם מלא</td><td style="padding:8px 12px;">${fullName}</td></tr>
              <tr><td style="padding:8px 12px;font-weight:bold;">טלפון</td><td style="padding:8px 12px;">${phone}</td></tr>
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold;">אימייל</td><td style="padding:8px 12px;">${email}</td></tr>
              <tr><td style="padding:8px 12px;font-weight:bold;">תפקיד</td><td style="padding:8px 12px;">${activeMode === "driver" ? "נהג" : "שולח"}</td></tr>
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold;">מקור</td><td style="padding:8px 12px;">${isFromOldSystem ? "⚠️ מערכת ישנה (Glide)" : "✅ משתמש חדש"}</td></tr>
              <tr><td style="padding:8px 12px;font-weight:bold;">UID</td><td style="padding:8px 12px;font-size:12px;color:#666;">${userId}</td></tr>
            </table>
          </div>
        `,
      });
      logger.info("Support BCC email sent for new user", { userId });
    } catch (emailErr) {
      // Non-fatal — don't fail the trigger if SMTP is down
      logger.warn("Failed to send support BCC email", { userId, error: String(emailErr) });
    }
  }
);

/**
 * Firestore onUpdate trigger for users.
 * - Handles KYC status changes
 * - Sends appropriate notifications
 */
export const onUserUpdate = onDocumentUpdated(
  { document: "users/{userId}", secrets: [smtpUser, smtpPass] },
  async (event) => {
    const change = event.data;
    if (!change) {
      logger.error("onUserUpdate: no data in event");
      return;
    }

    const userId = event.params.userId;
    const before = change.before.data() as User;
    const after = change.after.data() as User;

    // Enforce: old app versions write kycStatus='pending' at profile completion
    // without uploading docs. Remove it so only real submissions appear in admin.
    const afterHasKycDoc = !!(after as any).kycDocumentURL;
    if ((after as any).kycStatus === 'pending' && !afterHasKycDoc) {
      await change.after.ref.update({
        kycStatus: admin.firestore.FieldValue.delete(),
      });
      return; // kycStatus will be undefined on next trigger — no further action needed
    }

    // Handle KYC status change
    if (before.kycStatus !== after.kycStatus) {
      await handleKycStatusChange(userId, before.kycStatus, after.kycStatus);
    }

    // Notify admin when user submits KYC documents:
    // - First-time upload: kycDocumentURL transitions from empty to a URL
    // - Re-submission after rejection: kycStatus flips back to 'pending' with docs already present
    const beforeKycUrl = (before as any).kycDocumentURL || "";
    const afterKycUrl  = (after  as any).kycDocumentURL || "";
    const firstUpload    = !beforeKycUrl && !!afterKycUrl;
    const reSubmission   = before.kycStatus !== "pending" && after.kycStatus === "pending" && !!afterKycUrl;
    if (firstUpload || reSubmission) {
      await notifyAdminKycSubmitted(userId, after);
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
  logger.info("User KYC status changed", { userId, oldStatus, newStatus });

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

  // Send push notification
  await sendPushNotification(userId, titleHe, bodyHe, {
    event: newStatus === "approved" ? "kyc_approved" : "kyc_rejected",
    type: "kyc_status",
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
  logger.info("User account status changed", { userId, oldStatus, newStatus });

  if (newStatus === "suspended" || newStatus === "blocked") {
    const now = admin.firestore.Timestamp.now();
    const titleHe = newStatus === "suspended" ? "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05D4\u05D5\u05E9\u05E2\u05D4" : "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E0\u05D7\u05E1\u05DD";
    const bodyHe = `\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA ${newStatus === "suspended" ? "\u05D4\u05D5\u05E9\u05E2\u05D4" : "\u05E0\u05D7\u05E1\u05DD"}. \u05E6\u05E8\u05D5 \u05E7\u05E9\u05E8 \u05E2\u05DD \u05D4\u05EA\u05DE\u05D9\u05DB\u05D4 \u05DC\u05DE\u05D9\u05D3\u05E2 \u05E0\u05D5\u05E1\u05E3`;

    await db
      .collection("users")
      .doc(userId)
      .collection("notifications")
      .add({
        title: newStatus === "suspended" ? "Account Suspended" : "Account Blocked",
        titleHe,
        body: `Your account has been ${newStatus}. Please contact support for more information.`,
        bodyHe,
        type: "system",
        read: false,
        createdAt: now,
      });

    // Send push notification
    await sendPushNotification(userId, titleHe, bodyHe, {
      event: `account_${newStatus}`,
      type: "account_status",
    });
  }

  // Notify user when account is reactivated
  if (newStatus === "active" && (oldStatus === "suspended" || oldStatus === "blocked")) {
    const titleHe = "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05D4\u05D5\u05E4\u05E2\u05DC \u05DE\u05D7\u05D3\u05E9";
    const bodyHe = "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA \u05D4\u05D5\u05E4\u05E2\u05DC \u05DE\u05D7\u05D3\u05E9. \u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD!";

    await db
      .collection("users")
      .doc(userId)
      .collection("notifications")
      .add({
        title: "Account Reactivated",
        titleHe,
        body: "Your account has been reactivated. Welcome back!",
        bodyHe,
        type: "system",
        read: false,
        createdAt: admin.firestore.Timestamp.now(),
      });

    await sendPushNotification(userId, titleHe, bodyHe, {
      event: "account_reactivated",
      type: "account_status",
    });
  }
}

/**
 * Send email to admin when a user submits KYC documents.
 */
async function notifyAdminKycSubmitted(userId: string, user: User): Promise<void> {
  try {
    const smtpUserVal = smtpUser.value();
    const smtpPassVal = smtpPass.value();
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: { user: smtpUserVal, pass: smtpPassVal },
    });
    await transporter.sendMail({
      from: `Mooviz Social Deliveries <${smtpUserVal}>`,
      to: "admin@mooviz.co.il",
      subject: `אימות KYC חדש ממתין לאישור — ${user.fullName || userId}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#1976D2">בקשת KYC חדשה</h2>
          <p>משתמש חדש העלה מסמכי KYC ומחכה לאישור:</p>
          <table style="border-collapse:collapse;width:100%">
            <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">שם</td><td style="padding:8px 12px">${user.fullName || "—"}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold">אימייל</td><td style="padding:8px 12px">${(user as any).email || "—"}</td></tr>
            <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">טלפון</td><td style="padding:8px 12px">${user.phone || "—"}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold">UID</td><td style="padding:8px 12px;font-size:12px;color:#666">${userId}</td></tr>
          </table>
          <p style="margin-top:16px"><a href="https://admin.mooviz.co.il/users/${userId}" style="background:#1976D2;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">פתח בפאנל הניהול</a></p>
        </div>
      `,
    });
    logger.info("KYC admin notification sent", { userId });
  } catch (err) {
    logger.warn("Failed to send KYC admin email", { userId, error: String(err) });
  }
}
