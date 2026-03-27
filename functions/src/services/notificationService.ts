import * as admin from "firebase-admin";
import {
  NotificationEventType,
  NOTIFICATION_TEMPLATES,
  interpolateTemplate,
} from "@mooviz/shared";
import { logger } from "../utils/logger";

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Send a push notification to a specific user by looking up their FCM token.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  sound?: string,
  fcmTokens?: string | string[]
): Promise<boolean> {
  try {
    // Resolve tokens from caller or Firestore
    let tokens: string[] = [];

    if (fcmTokens) {
      tokens = Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens];
    } else {
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        logger.warn("sendPushNotification: user not found", { userId });
        return false;
      }
      const userData = userDoc.data();
      const raw = userData?.fcmTokens;
      if (Array.isArray(raw)) {
        tokens = raw.filter((t: unknown) => typeof t === "string" && t.length > 0);
      } else if (typeof raw === "string" && raw.length > 0) {
        tokens = [raw];
      }
      // Backward compat: also check legacy single `fcmToken` field
      const legacy = userData?.fcmToken;
      if (typeof legacy === "string" && legacy.length > 0 && !tokens.includes(legacy)) {
        tokens.push(legacy);
      }
    }

    // Deduplicate
    tokens = tokens.filter((t, i) => tokens.indexOf(t) === i);

    if (tokens.length === 0) {
      logger.warn("sendPushNotification: no FCM tokens for user", { userId });
      return false;
    }

    const multicastMessage: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
      data: data ?? {},
      android: {
        priority: "high",
        notification: {
          channelId: "mooviz_deliveries",
          sound: sound ?? "success",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: sound ? `${sound}.mp3` : "default",
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(multicastMessage);
    logger.info("Push notification sent", { userId, successCount: response.successCount, totalTokens: tokens.length });

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          } else {
            logger.warn("FCM error for user", { userId, tokenIndex: idx, code, errorMessage: resp.error.message });
          }
        }
      });

      if (invalidTokens.length > 0) {
        logger.warn("Removing invalid FCM tokens", { userId, count: invalidTokens.length });
        await db.collection("users").doc(userId).update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        });
      }
    }

    return response.successCount > 0;
  } catch (error: unknown) {
    logger.error("Failed to send push notification", { userId, error: String(error) });
    return false;
  }
}

/**
 * Send a delivery-related notification based on the event type.
 * Determines recipients and builds the message from templates.
 */
export async function sendDeliveryNotification(
  deliveryId: string,
  event: NotificationEventType,
  extraData?: Record<string, string>,
  deliveryData?: FirebaseFirestore.DocumentData
): Promise<void> {
  const template = NOTIFICATION_TEMPLATES[event];
  if (!template) {
    logger.error("Unknown notification event", { event });
    return;
  }

  let delivery: FirebaseFirestore.DocumentData;
  if (deliveryData) {
    // Use caller-provided delivery data, skip Firestore read
    delivery = deliveryData;
  } else {
    // Fallback: read from Firestore
    const deliveryDoc = await db.collection("deliveries").doc(deliveryId).get();
    if (!deliveryDoc.exists) {
      logger.error("Delivery not found for notification", { deliveryId });
      return;
    }
    delivery = deliveryDoc.data()!;
  }
  const senderId: string = delivery.senderId;
  const driverId: string | undefined = delivery.driverId;

  // Build template values
  const values: Record<string, string> = {
    deliveryId,
    pickupCity: delivery.pickup?.city || delivery.pickup?.address?.split(",")[0] || "",
    destinationCity: delivery.destination?.city || delivery.destination?.address?.split(",")[0] || "",
    price: String(delivery.price ?? 0),
    ...extraData,
  };

  // If we need driver info, look it up
  if (driverId) {
    const driverDoc = await db.collection("users").doc(driverId).get();
    if (driverDoc.exists) {
      const driverData = driverDoc.data()!;
      if (!values.driverName) {
        values.driverName = driverData.nickname || driverData.fullName?.split(' ')[0] || "Driver";
      }
      // Enrich driver_interested notifications
      if (event === "driver_interested") {
        values.driverRating = String(driverData.ratingAsDriver?.average?.toFixed(1) ?? "0");
        values.driverDeliveries = String(driverData.completedDeliveries ?? 0);
        values.driverPhoto = driverData.profilePhotoURL ?? "";
      }
    }
  }

  // Hebrew-first: use Hebrew templates by default
  const title = interpolateTemplate(template.titleHe, values);
  const body = interpolateTemplate(template.bodyHe, values);
  const notificationData: Record<string, string> = {
    event,
    deliveryId,
    ...Object.fromEntries(
      template.dataKeys
        .filter((key) => values[key] !== undefined)
        .map((key) => [key, values[key]])
    ),
  };

  // Add recipientRole so the client routes to the correct detail screen
  const recipientRoleMap: Record<string, string> = {};
  if (template.recipient === "sender" || template.recipient === "both") {
    recipientRoleMap[senderId] = "sender";
  }
  if ((template.recipient === "driver" || template.recipient === "both") && driverId) {
    recipientRoleMap[driverId] = "driver";
  }

  // Determine recipients and send
  const recipients: string[] = [];

  if (template.recipient === "sender" || template.recipient === "both") {
    recipients.push(senderId);
  }
  if ((template.recipient === "driver" || template.recipient === "both") && driverId) {
    recipients.push(driverId);
  }

  // If the actor triggered the event, don't notify them
  const actorId = extraData?.actorId;
  const filteredRecipients = actorId
    ? recipients.filter((id) => id !== actorId)
    : recipients;

  logger.info("sendDeliveryNotification", { event, recipients: filteredRecipients, actorId, title });

  // Map event to custom sound file (must exist in Android res/raw/ without extension)
  const EVENT_SOUNDS: Record<string, string> = {
    new_listing_nearby: "new_delivery",
    driver_interested: "driver_interested",
    payment_confirmed: "payment",
    sender_approved: "success",
    delivery_picked_up: "success",
    delivery_delivered: "success",
    delivery_cancelled: "error",
    new_chat_message: "question",
  };
  const soundName = EVENT_SOUNDS[event] ?? "success";

  const results = await Promise.all(
    filteredRecipients.map((userId) =>
      sendPushNotification(userId, title, body, { ...notificationData, recipientRole: recipientRoleMap[userId] || "sender" }, soundName)
    )
  );

  logger.info("sendDeliveryNotification results", { event, results });
}
