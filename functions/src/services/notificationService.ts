import * as admin from "firebase-admin";
import {
  NotificationEventType,
  NOTIFICATION_TEMPLATES,
  interpolateTemplate,
} from "@mooviz/shared";

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Send a push notification to a specific user by looking up their FCM token.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  let fcmToken: string | undefined;
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.warn(`sendPushNotification: user ${userId} not found`);
      return false;
    }

    const userData = userDoc.data();
    const tokens = userData?.fcmTokens;
    fcmToken = Array.isArray(tokens) ? tokens[tokens.length - 1] : tokens;

    if (!fcmToken || typeof fcmToken !== "string") {
      console.warn(`sendPushNotification: no FCM token for user ${userId}`);
      return false;
    }

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data ?? {},
      android: {
        priority: "high",
        notification: {
          channelId: "mooviz_deliveries",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    await messaging.send(message);
    console.log(`Push notification sent to user ${userId}`);
    return true;
  } catch (error: unknown) {
    const err = error as { code?: string };
    // If the token is invalid, clear it from the user document
    if (
      err.code === "messaging/invalid-registration-token" ||
      err.code === "messaging/registration-token-not-registered"
    ) {
      console.warn(`Invalid FCM token for user ${userId}, clearing token`);
      await db.collection("users").doc(userId).update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(fcmToken) });
    } else {
      console.error(`Failed to send push notification to user ${userId}:`, error);
    }
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
  extraData?: Record<string, string>
): Promise<void> {
  const template = NOTIFICATION_TEMPLATES[event];
  if (!template) {
    console.error(`Unknown notification event: ${event}`);
    return;
  }

  const deliveryDoc = await db.collection("deliveries").doc(deliveryId).get();
  if (!deliveryDoc.exists) {
    console.error(`Delivery ${deliveryId} not found for notification`);
    return;
  }

  const delivery = deliveryDoc.data()!;
  const senderId: string = delivery.senderId;
  const driverId: string | undefined = delivery.driverId;

  // Build template values
  const values: Record<string, string> = {
    deliveryId,
    pickupCity: delivery.pickup?.city ?? "",
    destinationCity: delivery.destination?.city ?? "",
    price: String(delivery.price ?? 0),
    ...extraData,
  };

  // If we need driver name, look it up
  if (driverId && !values.driverName) {
    const driverDoc = await db.collection("users").doc(driverId).get();
    if (driverDoc.exists) {
      values.driverName = driverDoc.data()?.fullName ?? "Driver";
    }
  }

  const title = interpolateTemplate(template.titleEn, values);
  const body = interpolateTemplate(template.bodyEn, values);
  const notificationData: Record<string, string> = {
    event,
    deliveryId,
    ...Object.fromEntries(
      template.dataKeys
        .filter((key) => values[key] !== undefined)
        .map((key) => [key, values[key]])
    ),
  };

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

  await Promise.all(
    filteredRecipients.map((userId) =>
      sendPushNotification(userId, title, body, notificationData)
    )
  );
}
