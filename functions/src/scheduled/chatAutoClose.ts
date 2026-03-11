import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = admin.firestore();

const CHAT_CLOSE_HOURS = 12;
const CLOSE_MESSAGE =
  "🔒 הצ׳אט נסגר אוטומטית 12 שעות לאחר סיום המשלוח. לא ניתן לשלוח הודעות נוספות.";

/**
 * Scheduled function that runs every hour.
 * Finds chats linked to completed deliveries where chatCloseAt has passed
 * and marks them as closed with a system message.
 */
export const chatAutoClose = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "Asia/Jerusalem",
    retryCount: 3,
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    console.log(`Running chat auto-close at ${now.toDate().toISOString()}`);

    // Find chats where chatCloseAt has passed and chat is not yet closed
    const snapshot = await db
      .collection("chats")
      .where("chatCloseAt", "<=", now)
      .where("closed", "==", false)
      .limit(500)
      .get();

    if (snapshot.empty) {
      console.log("No chats to close");
      return;
    }

    console.log(`Found ${snapshot.size} chats to close`);

    let closed = 0;
    for (const chatDoc of snapshot.docs) {
      try {
        // Mark chat as closed
        await chatDoc.ref.update({
          closed: true,
          closedAt: now,
        });

        // Send system message
        await chatDoc.ref.collection("messages").add({
          type: "system",
          text: CLOSE_MESSAGE,
          senderId: "system",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: true,
        });

        // Update chat metadata
        await chatDoc.ref.update({
          lastMessage: CLOSE_MESSAGE,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSenderId: "system",
        });

        closed++;
        console.log(`  [OK] Closed chat ${chatDoc.id}`);
      } catch (error) {
        console.error(`  [FAIL] Chat ${chatDoc.id}:`, error);
      }
    }

    console.log(`Chat auto-close complete: ${closed} chats closed`);
  }
);
