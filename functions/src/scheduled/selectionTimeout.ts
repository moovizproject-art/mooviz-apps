import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { sendPushNotification } from "../services/notificationService";

const db = admin.firestore();

export const selectionTimeout = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Jerusalem",
    retryCount: 1,
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection("deliveries")
      .where("status", "==", "new")
      .where("selectionExpiresAt", "<=", now)
      .limit(50)
      .get();

    if (snapshot.empty) return;

    console.log(`[selectionTimeout] Found ${snapshot.size} expired selections`);

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const selectedDriverId = data.selectedDriverId;
        if (!selectedDriverId) continue;

        const interested: any[] = data.interestedDrivers || [];
        const updated = interested.map((d: any) =>
          d.uid === selectedDriverId ? { ...d, status: "declined" } : d
        );

        await doc.ref.update({
          interestedDrivers: updated,
          selectedDriverId: null,
          selectionExpiresAt: null,
          updatedAt: now,
        });

        await sendPushNotification(
          data.senderId,
          "הנהג לא הגיב בזמן",
          "בחר נהג אחר מהרשימה",
          { event: "selection_timeout", deliveryId: doc.id }
        ).catch(() => {});

        await sendPushNotification(
          selectedDriverId,
          "פג תוקף הבחירה",
          "לא אישרת בזמן, השולח יבחר נהג אחר",
          { event: "selection_timeout", deliveryId: doc.id }
        ).catch(() => {});

        console.log(`[selectionTimeout] Expired selection for delivery ${doc.id}, driver ${selectedDriverId}`);
      } catch (error) {
        console.error(`[selectionTimeout] Error processing ${doc.id}:`, error);
      }
    }
  }
);
