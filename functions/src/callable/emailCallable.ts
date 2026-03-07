import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";

const db = admin.firestore();
const messaging = admin.messaging();

const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

interface SendBulkEmailData {
  to: string[] | "all";
  subject: string;
  htmlBody: string;
  sendPush?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * sendBulkEmail — Admin-only callable for email (+ optional push) broadcasting.
 * Accepts { to: string[] | 'all', subject, htmlBody, sendPush? }.
 * Batches sends in groups of 50 with rate limiting.
 */
export const sendBulkEmail = functions.onCall(
  { secrets: [smtpUser, smtpPass], cors: true },
  async (request) => {
    // Validate caller is admin
    if (!request.auth) {
      throw new functions.HttpsError(
        "unauthenticated",
        "Authentication required"
      );
    }

    const callerDoc = await db
      .collection("users")
      .doc(request.auth.uid)
      .get();
    const callerData = callerDoc.data();
    const callerRole = callerData?.role;

    if (callerRole !== "admin" && callerRole !== "moderator") {
      throw new functions.HttpsError(
        "permission-denied",
        "Only admins can send bulk emails"
      );
    }

    const { to, subject, htmlBody, sendPush } =
      request.data as SendBulkEmailData;

    if (!subject || !htmlBody) {
      throw new functions.HttpsError(
        "invalid-argument",
        "subject and htmlBody are required"
      );
    }

    // Resolve recipient emails + FCM tokens
    let recipients: { email: string; fcmTokens?: string[] }[] = [];

    if (to === "all") {
      const snapshot = await db.collection("users").get();
      recipients = snapshot.docs
        .map((doc) => ({
          email: doc.data().email as string,
          fcmTokens: (doc.data().fcmTokens as string[]) || [],
        }))
        .filter((r) => r.email);
    } else if (Array.isArray(to)) {
      // to contains user IDs
      for (let i = 0; i < to.length; i += BATCH_SIZE) {
        const batch = to.slice(i, i + BATCH_SIZE);
        const docs = await Promise.all(
          batch.map((uid) => db.collection("users").doc(uid).get())
        );
        for (const doc of docs) {
          if (doc.exists) {
            const data = doc.data()!;
            if (data.email) {
              recipients.push({
                email: data.email,
                fcmTokens: (data.fcmTokens as string[]) || [],
              });
            }
          }
        }
      }
    } else {
      throw new functions.HttpsError(
        "invalid-argument",
        "to must be 'all' or an array of user IDs"
      );
    }

    if (recipients.length === 0) {
      return { sent: 0, errors: 0, message: "No valid recipients found" };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser.value(),
        pass: smtpPass.value(),
      },
    });

    let sentCount = 0;
    let errorCount = 0;

    // Send emails in batches
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const emailPromises = batch.map(async (recipient) => {
        try {
          await transporter.sendMail({
            from: `MOOVIZ <${smtpUser.value()}>`,
            to: recipient.email,
            subject,
            html: htmlBody,
          });
          sentCount++;
        } catch {
          errorCount++;
        }
      });

      await Promise.all(emailPromises);

      // Rate limit between batches
      if (i + BATCH_SIZE < recipients.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    // Optional: send push notifications
    let pushSent = 0;
    if (sendPush) {
      const allTokens = recipients
        .flatMap((r) => r.fcmTokens || [])
        .filter((t) => t && typeof t === "string");

      for (let i = 0; i < allTokens.length; i += 500) {
        const tokenBatch = allTokens.slice(i, i + 500);
        try {
          const result = await messaging.sendEachForMulticast({
            tokens: tokenBatch,
            notification: {
              title: subject,
              body: htmlBody.replace(/<[^>]*>/g, "").slice(0, 200),
            },
          });
          pushSent += result.successCount;
        } catch {
          // Push errors are non-fatal
        }
      }
    }

    // Log admin action
    await db.collection("adminActions").add({
      adminId: request.auth.uid,
      action: "bulk_email",
      details: {
        recipientCount: recipients.length,
        subject,
        sentCount,
        errorCount,
        pushSent: sendPush ? pushSent : undefined,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      sent: sentCount,
      errors: errorCount,
      pushSent: sendPush ? pushSent : undefined,
      message: `Email sent to ${sentCount}/${recipients.length} recipients`,
    };
  }
);
