import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getNearbyDriverTokensMultiLocation } from "../services/geohashService";
import { sendPushNotification } from "../services/notificationService";

const db = admin.firestore();

/** Expand notification radius by this many km each cycle */
const EXPANSION_STEP_KM = 5;

/** Maximum number of expansion cycles per delivery */
const MAX_EXPANSIONS = 10;

/**
 * Scheduled function that runs every 2 minutes.
 * For each 'new' delivery that hasn't maxed out expansions,
 * expands the notification radius by 5km and notifies new drivers
 * who weren't already notified.
 *
 * Timeline (starting from 15km default):
 *   0:00 → 15km (initial, set by deliveryTrigger)
 *   0:02 → 20km
 *   0:04 → 25km
 *   ...
 *   0:20 → 65km (final, expansion #10)
 *
 * Stops when: delivery leaves 'new' status OR 10 expansions reached.
 */
export const notifyExpansion = onSchedule(
  {
    schedule: "every 2 minutes",
    timeZone: "Asia/Jerusalem",
    retryCount: 1,
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const twoMinAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - 2 * 60 * 1000
    );

    console.log(`[notifyExpansion] Running at ${now.toDate().toISOString()}`);

    // Find deliveries eligible for expansion.
    // Uses single inequality (lastNotifyExpansion) to avoid multi-inequality index requirement.
    // notifyExpansionCount is filtered in code below.
    const snapshot = await db
      .collection("deliveries")
      .where("status", "==", "new")
      .where("lastNotifyExpansion", "<=", twoMinAgo)
      .limit(50)
      .get();

    // Filter out deliveries that already reached max expansions
    const eligibleDocs = snapshot.docs.filter((doc) => {
      const count = doc.data().notifyExpansionCount ?? 0;
      return count < MAX_EXPANSIONS;
    });

    if (eligibleDocs.length === 0) {
      console.log("[notifyExpansion] No deliveries to expand");
      return;
    }

    console.log(`[notifyExpansion] Found ${eligibleDocs.length} deliveries to expand`);

    for (const doc of eligibleDocs) {
      try {
        const delivery = doc.data();
        const deliveryId = doc.id;

        const currentRadius: number = delivery.notifyRadius || 15;
        const newRadius = currentRadius + EXPANSION_STEP_KM;
        const expansionCount: number = (delivery.notifyExpansionCount || 0) + 1;
        const alreadyNotified: string[] = delivery.notifiedDrivers || [];

        // Get pickup coordinates
        const pickup = delivery.pickup;
        const pickupGeohash = pickup?.geohash as string | undefined;
        const pickupLat = (pickup?.lat ?? pickup?.latitude) as number | undefined;
        const pickupLng = (pickup?.lng ?? pickup?.longitude) as number | undefined;

        if (!pickupGeohash || !pickupLat || !pickupLng) {
          console.warn(`[notifyExpansion] Delivery ${deliveryId} missing pickup coords`);
          continue;
        }

        // Find new drivers in expanded radius (excluding already notified)
        const itemSize = delivery.item?.size as string | undefined;
        const newDrivers = await getNearbyDriverTokensMultiLocation(
          pickupGeohash,
          newRadius,
          pickupLat,
          pickupLng,
          alreadyNotified,
          itemSize
        );

        if (newDrivers.length > 0) {
          const pickupCity = (pickup?.city ?? "") as string;
          const destCity = (delivery.destination?.city ?? "") as string;
          const price = String(delivery.suggestedPrice ?? delivery.price ?? 0);

          await Promise.all(
            newDrivers.map((driver) =>
              sendPushNotification(
                driver.uid,
                "משלוח חדש באזורך",
                `משלוח חדש מ-${pickupCity} ל-${destCity} - ${price} ₪`,
                {
                  event: "new_listing_nearby",
                  deliveryId,
                  pickupCity,
                  destinationCity: destCity,
                  price,
                }
              )
            )
          );
        }

        // Update expansion tracking
        const newNotifiedList = [
          ...alreadyNotified,
          ...newDrivers.map((d) => d.uid),
        ];

        await doc.ref.update({
          notifiedDrivers: newNotifiedList,
          notifyRadius: newRadius,
          notifyExpansionCount: expansionCount,
          lastNotifyExpansion: now,
        });

        console.log(
          `[notifyExpansion] Delivery ${deliveryId}: radius ${currentRadius}→${newRadius}km, ` +
          `${newDrivers.length} new drivers notified (total: ${newNotifiedList.length}), ` +
          `expansion ${expansionCount}/${MAX_EXPANSIONS}`
        );
      } catch (error) {
        console.error(`[notifyExpansion] Error processing delivery ${doc.id}:`, error);
      }
    }
  }
);
