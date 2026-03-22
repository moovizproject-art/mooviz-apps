import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { sendPushNotification } from "../services/notificationService";
import { getNearbyDriverTokensMultiLocation } from "../services/geohashService";

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
      .where("status", "==", "awaiting_confirm")
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
          status: "new",
          driverId: null,
          driverName: null,
          driverPhotoUrl: null,
          driverRating: null,
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: "new",
            timestamp: now,
            actor: "system",
            note: "Driver selection timed out, reverted to new",
          }),
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

        // Re-notify nearby drivers (exclude timed-out driver)
        const pickupGeohash = data.pickup?.geohash;
        if (pickupGeohash) {
          const pickupCity = data.pickup?.city ?? "";
          const destCity = data.destination?.city ?? "";
          getNearbyDriverTokensMultiLocation(pickupGeohash, 15, data.pickup?.lat, data.pickup?.lng, [selectedDriverId])
            .then((nearbyDrivers) =>
              Promise.all(
                nearbyDrivers.map((driver) =>
                  sendPushNotification(
                    driver.uid,
                    "משלוח זמין באזורך",
                    `משלוח מ-${pickupCity} ל-${destCity} - ${data.price} ₪`,
                    {
                      event: "new_listing_nearby",
                      deliveryId: doc.id,
                      pickupCity,
                      destinationCity: destCity,
                      price: String(data.price ?? 0),
                    }
                  )
                )
              ).then(() => console.log(`[selectionTimeout] re-notified ${nearbyDrivers.length} nearby drivers for ${doc.id}`))
            )
            .catch((err) => console.error(`[selectionTimeout] nearby driver notification failed for ${doc.id}:`, err));
        }

        console.log(`[selectionTimeout] Expired selection for delivery ${doc.id}, driver ${selectedDriverId}`);
      } catch (error) {
        console.error(`[selectionTimeout] Error processing ${doc.id}:`, error);
      }
    }
  }
);
