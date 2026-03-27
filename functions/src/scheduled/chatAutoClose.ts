import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "../utils/logger";

const db = admin.firestore();

const CLOSE_MESSAGE =
  "🔒 הצ׳אט נסגר אוטומטית. לא ניתן לשלוח הודעות נוספות.";

/**
 * Scheduled function that runs every 10 minutes.
 * Finds chats where chatCloseAt has passed and marks them as closed
 * with a system message. Processes in parallel batches for efficiency.
 */
export const chatAutoClose = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: "Asia/Jerusalem",
    retryCount: 3,
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    logger.info("Running chat auto-close", { timestamp: now.toDate().toISOString() });

    const snapshot = await db
      .collection("chats")
      .where("chatCloseAt", "<=", now)
      .where("closed", "==", false)
      .limit(500)
      .get();

    if (snapshot.empty) {
      logger.info("No chats to close");
      return;
    }

    logger.info("Found chats to close", { count: snapshot.size });

    const closeChat = async (chatDoc: FirebaseFirestore.QueryDocumentSnapshot): Promise<boolean> => {
      try {
        // Single update for chat metadata + close status
        await chatDoc.ref.update({
          closed: true,
          closedAt: now,
          lastMessage: CLOSE_MESSAGE,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSenderId: "system",
        });

        // Add system message
        await chatDoc.ref.collection("messages").add({
          type: "system",
          text: CLOSE_MESSAGE,
          senderId: "system",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: true,
        });

        return true;
      } catch (error) {
        logger.error("Failed to close chat", { chatId: chatDoc.id, error: String(error) });
        return false;
      }
    };

    // Process in parallel batches of 20
    const BATCH_SIZE = 20;
    let closed = 0;
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      const batch = snapshot.docs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(closeChat));
      closed += results.filter(Boolean).length;
    }

    logger.info("Chat auto-close complete", { closed });
  }
);
