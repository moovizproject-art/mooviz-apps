import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { ChatMessage } from "@mooviz/shared";
import { sendPushNotification } from "../services/notificationService";

const db = admin.firestore();

/**
 * Firestore onCreate trigger for chat messages.
 * Sends a push notification to the other party in the chat.
 */
export const onMessageCreate = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.error("onMessageCreate: no data in event");
      return;
    }

    const chatId = event.params.chatId;
    const message = snapshot.data() as ChatMessage;

    // System messages don't trigger notifications
    if (message.type === "system") {
      return;
    }

    const senderId = message.senderId;

    // Get the chat room to find participants
    const chatRoomDoc = await db.collection("chats").doc(chatId).get();
    if (!chatRoomDoc.exists) {
      console.error(`Chat room ${chatId} not found`);
      return;
    }

    const chatRoom = chatRoomDoc.data();
    const participants: string[] = chatRoom?.participants ?? [];

    // Update the chat room with the last message info
    await chatRoomDoc.ref.update({
      lastMessage: message.type === "image" ? "[Image]" : (message.text ?? ""),
      lastMessageAt: admin.firestore.Timestamp.now(),
    });

    // Get sender's name for the notification
    const senderDoc = await db.collection("users").doc(senderId).get();
    const senderName = senderDoc.exists
      ? senderDoc.data()?.fullName ?? "Someone"
      : "Someone";

    // Build notification message preview
    let messagePreview: string;
    if (message.type === "image") {
      messagePreview = "\uD83D\uDCF7 Sent an image";
    } else {
      messagePreview = message.text ?? "";
      // Truncate long messages
      if (messagePreview.length > 100) {
        messagePreview = messagePreview.substring(0, 97) + "...";
      }
    }

    // Notify all other participants
    const recipientIds = participants.filter((id) => id !== senderId);

    await Promise.all(
      recipientIds.map((recipientId) =>
        sendPushNotification(
          recipientId,
          `${senderName}`,
          messagePreview,
          {
            event: "new_chat_message",
            chatId,
            deliveryId: chatRoom?.deliveryId ?? "",
            senderId,
            senderName,
          }
        )
      )
    );

    console.log(
      `Chat notification sent for room ${chatId} from ${senderId} to ${recipientIds.length} recipients`
    );
  }
);
