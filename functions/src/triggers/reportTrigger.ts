import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";
import { sendPushNotification } from "../services/notificationService";
import { logger } from "../utils/logger";

const db = admin.firestore();
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");

/**
 * On new report created → email admin@mooviz.co.il
 */
export const onReportCreate = onDocumentCreated(
  { document: "reports/{reportId}", secrets: [smtpUser, smtpPass] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const report = snapshot.data();
    const reportId = event.params.reportId;

    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
        auth: { user: smtpUser.value(), pass: smtpPass.value() },
      });

      const categoryLabels: Record<string, string> = {
        harassment: "הטרדה",
        fraud: "הונאה",
        damage: "נזק",
        no_show: "אי-הגעה",
        other: "אחר",
      };

      await transporter.sendMail({
        from: `MOOVIZ <${smtpUser.value()}>`,
        to: "admin@mooviz.co.il",
        subject: `דיווח חדש — ${categoryLabels[report.category] ?? report.category}`,
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px">
            <h2 style="color:#D32F2F">דיווח חדש התקבל</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">קטגוריה</td><td style="padding:8px 12px">${categoryLabels[report.category] ?? report.category}</td></tr>
              <tr><td style="padding:8px 12px;font-weight:bold">מדווח על</td><td style="padding:8px 12px">${report.reportedUserId || "—"}</td></tr>
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">מדווח ע"י</td><td style="padding:8px 12px">${report.reporterUserId || "—"}</td></tr>
              <tr><td style="padding:8px 12px;font-weight:bold">תיאור</td><td style="padding:8px 12px">${report.description || "—"}</td></tr>
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">משלוח</td><td style="padding:8px 12px">${report.deliveryId || "—"}</td></tr>
            </table>
            <p style="margin-top:16px"><a href="https://admin.mooviz.co.il/reports" style="background:#D32F2F;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">פתח דיווחים בניהול</a></p>
          </div>
        `,
      });
      logger.info("Report admin email sent", { reportId });
    } catch (err) {
      logger.warn("Failed to send report admin email", { reportId, error: String(err) });
    }
  }
);

/**
 * On report resolved/dismissed → push notification to reporter
 */
export const onReportUpdate = onDocumentUpdated(
  "reports/{reportId}",
  async (event) => {
    const change = event.data;
    if (!change) return;
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return;
    if (after.status !== "resolved" && after.status !== "dismissed") return;

    const reporterId: string | undefined = after.reporterUserId;
    if (!reporterId) return;

    const isResolved = after.status === "resolved";
    const title = isResolved ? "הדיווח שלך טופל" : "הדיווח שלך נסגר";
    const body = isResolved
      ? "הדיווח שלך נבדק ופעולה ננקטה. תודה שעזרת לשמור על הקהילה."
      : "הדיווח שלך נסגר ללא פעולה. אם תרצה תוכל לפנות אלינו.";

    await sendPushNotification(reporterId, title, body, {
      event: "report_resolved",
      reportId: event.params.reportId,
    });
  }
);
