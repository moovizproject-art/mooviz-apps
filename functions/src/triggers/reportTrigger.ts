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
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: smtpUser.value(), pass: smtpPass.value() },
      });

      const categoryLabels: Record<string, string> = {
        harassment: "הטרדה",
        fraud: "הונאה",
        damage: "נזק",
        no_show: "אי-הגעה",
        other: "אחר",
      };

      const categoryLabel = categoryLabels[report.category] ?? report.category;

      // Fetch reporter + reported user in parallel for the admin email
      const reporterId: string | undefined = report.reporterUserId;
      const reportedId: string | undefined = report.reportedUserId;

      const [reporterDoc, reportedDoc] = await Promise.all([
        reporterId ? db.collection("users").doc(reporterId).get() : Promise.resolve(null),
        reportedId ? db.collection("users").doc(reportedId).get() : Promise.resolve(null),
      ]);

      const reporter = reporterDoc?.data();
      const reported = reportedDoc?.data();

      const userRow = (label: string, data: Record<string, unknown> | undefined, uid: string | undefined, bg: string) => {
        if (!data || !uid) return `<tr style="background:${bg}"><td style="padding:8px 12px;font-weight:bold">${label}</td><td style="padding:8px 12px">—</td></tr>`;
        const name = (data.fullName || data.displayName || "—") as string;
        const phone = (data.phone || "—") as string;
        const email = (data.email || "—") as string;
        return `<tr style="background:${bg}"><td style="padding:8px 12px;font-weight:bold;vertical-align:top">${label}</td><td style="padding:8px 12px">
          <strong>${name}</strong><br/>
          📞 <a href="tel:${phone}" style="color:#1565C0;text-decoration:none">${phone}</a><br/>
          ✉️ <a href="mailto:${email}" style="color:#1565C0;text-decoration:none">${email}</a><br/>
          <a href="https://admin.mooviz.co.il/users/${uid}" style="font-size:12px;color:#9ca3af">פתח פרופיל</a>
        </td></tr>`;
      };

      // Email to admin
      await transporter.sendMail({
        from: `Mooviz Social Deliveries <${smtpUser.value()}>`,
        to: "admin@mooviz.co.il",
        subject: `דיווח חדש — ${categoryLabel}`,
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px">
            <h2 style="color:#D32F2F">דיווח חדש התקבל</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">קטגוריה</td><td style="padding:8px 12px">${categoryLabel}</td></tr>
              ${userRow("מדווח על", reported, reportedId, "#ffffff")}
              ${userRow("מדווח ע\"י", reporter, reporterId, "#f5f5f5")}
              <tr><td style="padding:8px 12px;font-weight:bold">תיאור</td><td style="padding:8px 12px">${report.description || "—"}</td></tr>
              <tr style="background:#f5f5f5"><td style="padding:8px 12px;font-weight:bold">משלוח</td><td style="padding:8px 12px">${report.deliveryId || "—"}</td></tr>
            </table>
            <p style="margin-top:16px"><a href="https://admin.mooviz.co.il/reports" style="background:#D32F2F;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">פתח דיווחים בניהול</a></p>
          </div>
        `,
      });
      logger.info("Report admin email sent", { reportId });

      // Confirmation email to reporter (reuse already-fetched reporter data)
      if (reporterId) {
        const reporterEmail: string | undefined = reporter?.email as string | undefined;
        if (reporterEmail) {
          await transporter.sendMail({
            from: `Mooviz Social Deliveries <${smtpUser.value()}>`,
            to: reporterEmail,
            subject: "הדיווח שלך התקבל — MOOVIZ",
            html: `
              <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
                <div style="text-align:center;margin-bottom:24px">
                  <img src="https://firebasestorage.googleapis.com/v0/b/mooviz-prod.appspot.com/o/brand%2Flogo.png?alt=media" alt="MOOVIZ" style="height:60px" />
                </div>
                <div style="background:#ffffff;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
                  <h2 style="margin-top:0;color:#1565C0">📋 הדיווח שלך התקבל</h2>
                  <p style="color:#374151">שלום,</p>
                  <p style="color:#374151">תודה על הדיווח. קיבלנו את פנייתך ונטפל בה בהקדם האפשרי.</p>
                  <table style="border-collapse:collapse;width:100%;margin:16px 0">
                    <tr style="background:#f3f4f6"><td style="padding:10px 14px;font-weight:bold;color:#374151">קטגוריה</td><td style="padding:10px 14px;color:#374151">${categoryLabel}</td></tr>
                    ${report.description ? `<tr><td style="padding:10px 14px;font-weight:bold;color:#374151">תיאור</td><td style="padding:10px 14px;color:#374151">${report.description}</td></tr>` : ""}
                  </table>
                  <p style="color:#6b7280;font-size:13px;margin-top:20px">נעדכן אותך כשהדיווח יטופל. תודה שעוזר לשמור על הקהילה.</p>
                </div>
                <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px">© MOOVIZ — פלטפורמת משלוחים קהילתית</p>
              </div>
            `,
          });
          logger.info("Report confirmation email sent to reporter", { reportId, reporterEmail });
        }
      }
    } catch (err) {
      logger.warn("Failed to send report emails", { reportId, error: String(err) });
    }
  }
);

/**
 * On report resolved/dismissed → push notification + branded email to reporter
 */
export const onReportUpdate = onDocumentUpdated(
  { document: "reports/{reportId}", secrets: [smtpUser, smtpPass] },
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

    // Push notification
    await sendPushNotification(reporterId, title, body, {
      event: "report_resolved",
      reportId: event.params.reportId,
    });

    // Branded email to reporter
    try {
      const reporterDoc = await db.collection("users").doc(reporterId).get();
      const reporterEmail: string | undefined = reporterDoc.data()?.email;
      if (!reporterEmail) return;

      const adminNote: string = after.moderatorNote || "";
      const categoryLabels: Record<string, string> = {
        harassment: "הטרדה", fraud: "הונאה", damage: "נזק", no_show: "אי-הגעה", other: "אחר",
      };
      const categoryLabel = categoryLabels[after.category] ?? after.category ?? "—";

      const transporter = nodemailer.createTransport({
        host: "smtp.hostinger.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: smtpUser.value(), pass: smtpPass.value() },
      });

      await transporter.sendMail({
        from: `Mooviz Social Deliveries <${smtpUser.value()}>`,
        to: reporterEmail,
        subject: isResolved ? "הדיווח שלך טופל — MOOVIZ" : "הדיווח שלך נסגר — MOOVIZ",
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
            <div style="text-align:center;margin-bottom:24px">
              <img src="https://firebasestorage.googleapis.com/v0/b/mooviz-prod.appspot.com/o/brand%2Flogo.png?alt=media" alt="MOOVIZ" style="height:60px" />
            </div>
            <div style="background:#ffffff;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
              <h2 style="margin-top:0;color:${isResolved ? "#1565C0" : "#616161"}">${isResolved ? "✅ הדיווח שלך טופל" : "📋 הדיווח שלך נסגר"}</h2>
              <p style="color:#374151">שלום,</p>
              <p style="color:#374151">${body}</p>
              <table style="border-collapse:collapse;width:100%;margin:16px 0">
                <tr style="background:#f3f4f6"><td style="padding:10px 14px;font-weight:bold;color:#374151">קטגוריה</td><td style="padding:10px 14px;color:#374151">${categoryLabel}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:bold;color:#374151">סטטוס</td><td style="padding:10px 14px;color:${isResolved ? "#166534" : "#4b5563"};font-weight:600">${isResolved ? "טופל" : "נסגר"}</td></tr>
                ${adminNote ? `<tr style="background:#f3f4f6"><td style="padding:10px 14px;font-weight:bold;color:#374151">הערת הצוות</td><td style="padding:10px 14px;color:#374151">${adminNote}</td></tr>` : ""}
              </table>
              <p style="color:#6b7280;font-size:13px;margin-top:20px">אם יש לך שאלות נוספות, תוכל לפנות אלינו בכל עת.</p>
            </div>
            <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px">© MOOVIZ — פלטפורמת משלוחים קהילתית</p>
          </div>
        `,
      });
      logger.info("Report resolution email sent to reporter", { reporterId, reporterEmail });
    } catch (emailErr) {
      logger.warn("Failed to send report resolution email", { reporterId, error: String(emailErr) });
    }
  }
);
