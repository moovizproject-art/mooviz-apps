import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  Delivery,
  DeliveryStatus,
  StatusEntry,
  DEFAULT_TIMEOUT_HOURS,
} from "@mooviz/shared";
import {
  assertValidTransition,
  assertIsSender,
  assertIsDriver,
  assertUserRole,
  assertDriverApproved,
} from "../validators/statusValidator";
import { sendDeliveryNotification, sendPushNotification } from "../services/notificationService";
import { getNearbyDriverTokensMultiLocation, encodeGeohash } from "../services/geohashService";
import { logger } from "../utils/logger";

const db = admin.firestore();
const GEOHASH_PRECISION = 7;

/**
 * Fire-and-forget: re-notify nearby drivers about a delivery that's available again.
 * Excludes specified driver UIDs (cancelled/declined drivers + sender).
 */
function renotifyNearbyDrivers(
  delivery: Delivery,
  deliveryId: string,
  excludeUids: string[],
  context: string,
): void {
  const pickupGeohash = delivery.pickup?.geohash;
  if (!pickupGeohash) return;

  const pickupCity = delivery.pickup?.city ?? "";
  const destCity = delivery.destination?.city ?? "";

  getNearbyDriverTokensMultiLocation(pickupGeohash, 15, delivery.pickup?.lat, delivery.pickup?.lng, excludeUids)
    .then((nearbyDrivers: import("../services/geohashService").NearbyDriver[]) =>
      Promise.all(
        nearbyDrivers.map((driver: import("../services/geohashService").NearbyDriver) =>
          sendPushNotification(
            driver.uid,
            "משלוח זמין באזורך",
            `משלוח מ-${pickupCity} ל-${destCity} - ${delivery.price} ₪`,
            {
              event: "new_listing_nearby",
              deliveryId,
              pickupCity,
              destinationCity: destCity,
              price: String(delivery.price ?? 0),
            },
            "new_delivery"
          )
        )
      ).then(() => logger.info("Renotified nearby drivers", { context, count: nearbyDrivers.length }))
    )
    .catch((err: unknown) => logger.error("Nearby driver renotification failed", { context, error: String(err) }));
}

/**
 * Helper to get a delivery document or throw.
 */
async function getDeliveryOrThrow(
  deliveryId: string
): Promise<{ delivery: Delivery; ref: FirebaseFirestore.DocumentReference }> {
  if (!deliveryId || typeof deliveryId !== "string") {
    throw new HttpsError("invalid-argument", "deliveryId is required");
  }

  const ref = db.collection("deliveries").doc(deliveryId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new HttpsError("not-found", `Delivery ${deliveryId} not found`);
  }

  return { delivery: doc.data() as Delivery, ref };
}

/**
 * Helper to add a status entry and update the delivery.
 */
async function updateDeliveryStatus(
  ref: FirebaseFirestore.DocumentReference,
  newStatus: DeliveryStatus,
  actor: string,
  note?: string,
  extraFields?: Record<string, unknown>
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const statusEntry: StatusEntry = {
    status: newStatus,
    timestamp: now,
    actor,
    note,
  };

  await ref.update({
    status: newStatus,
    statusHistory: admin.firestore.FieldValue.arrayUnion(statusEntry),
    updatedAt: now,
    ...extraFields,
  });
}

/**
 * Create a new delivery.
 * Validates input, normalizes field names to HLD format, computes geohash,
 * denormalizes sender info, and notifies nearby drivers.
 */
export const createDelivery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  logger.info("createDelivery: starting", { uid });
  const senderData = await assertUserRole(db, uid, "sender");

  const d = request.data;

  // --- Extract & normalize coordinates ---
  const pickupRaw = d.pickup;
  const destRaw = d.destination;
  if (!pickupRaw || !destRaw) {
    throw new HttpsError("invalid-argument", "pickup and destination are required");
  }

  const pickupLat = pickupRaw.lat ?? pickupRaw.latitude;
  const pickupLng = pickupRaw.lng ?? pickupRaw.longitude;
  const destLat = destRaw.lat ?? destRaw.latitude;
  const destLng = destRaw.lng ?? destRaw.longitude;

  if (typeof pickupLat !== "number" || typeof pickupLng !== "number" || (pickupLat === 0 && pickupLng === 0)) {
    throw new HttpsError("invalid-argument", "יש לבחור כתובת איסוף תקינה מהמפה");
  }
  if (typeof destLat !== "number" || typeof destLng !== "number" || (destLat === 0 && destLng === 0)) {
    throw new HttpsError("invalid-argument", "יש לבחור כתובת יעד תקינה מהמפה");
  }

  // --- Normalize item ---
  const itemDescription: string =
    d.item?.description ?? d.itemDescription ?? "";
  const itemSize: string = d.item?.size ?? d.itemSize ?? "";
  const itemType: string = d.item?.type ?? d.itemType ?? "general";
  const photoURL: string = d.item?.photoURL ?? d.photoUrl ?? "";
  const mediaURLs: string[] = Array.isArray(d.mediaURLs) ? d.mediaURLs : [];

  if (!itemDescription) {
    throw new HttpsError("invalid-argument", "item description is required");
  }

  // --- Normalize price ---
  const price: number = typeof d.price === "number" ? d.price
    : typeof d.suggestedPrice === "number" ? d.suggestedPrice : 0;
  if (price <= 0) {
    throw new HttpsError("invalid-argument", "price must be a positive number");
  }

  // --- Normalize pickupDate ---
  const rawDate = d.pickupDate ?? d.scheduledDate;
  let pickupDate: admin.firestore.Timestamp | "asap";
  if (!rawDate || rawDate === "asap") {
    pickupDate = "asap";
  } else if (typeof rawDate === "string") {
    const ms = Date.parse(rawDate);
    if (isNaN(ms)) {
      throw new HttpsError("invalid-argument", "Invalid date format for pickupDate");
    }
    pickupDate = admin.firestore.Timestamp.fromMillis(ms);
  } else {
    pickupDate = "asap";
  }

  // --- Normalize timeRange ---
  const VALID_TIME_RANGES = ["morning", "afternoon", "evening", "night"];
  const timeRange: string | null =
    typeof d.timeRange === "string" && VALID_TIME_RANGES.includes(d.timeRange)
      ? d.timeRange
      : null;

  // --- Compute geohash ---
  const pickupGeohash = encodeGeohash(pickupLat, pickupLng, GEOHASH_PRECISION);
  const destGeohash = encodeGeohash(destLat, destLng, GEOHASH_PRECISION);

  // --- Duplicate delivery cooldown (2 minutes) ---
  // Non-blocking: if the index is missing, skip the check rather than fail the delivery.
  try {
    const TWO_MIN_AGO = admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 1000);
    const recentByUser = await db.collection("deliveries")
      .where("senderId", "==", uid)
      .where("createdAt", ">=", TWO_MIN_AGO)
      .limit(10)
      .get();

    const isDuplicate = recentByUser.docs.some((d) => {
      const data = d.data();
      return data.pickup?.geohash === pickupGeohash
        && data.destination?.geohash === destGeohash
        && ["new", "pending", "awaiting_confirm", "waiting_for_pickup"].includes(data.status);
    });

    if (isDuplicate) {
      throw new HttpsError(
        "already-exists",
        "שלחת משלוח לאותו יעד לפני פחות מ-2 דקות. נסה שוב בעוד רגע."
      );
    }
  } catch (err: unknown) {
    // Re-throw HttpsError (duplicate found), but swallow index errors
    if (err instanceof HttpsError) throw err;
    logger.warn("createDelivery: duplicate check skipped (index building?)", { error: (err as Error).message });
  }

  // --- Sender info (already fetched by assertUserRole) ---
  const senderName = senderData?.nickname || senderData?.fullName || "";
  const senderPhotoUrl = senderData?.profilePhotoURL || "";
  const senderRating = senderData?.ratingAsSender?.average ?? null;

  // --- Build delivery document (HLD-canonical format) ---
  const now = admin.firestore.Timestamp.now();
  const timeoutAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + DEFAULT_TIMEOUT_HOURS * 60 * 60 * 1000
  );

  // Extract city from address string (Google format: "Street, City, Postal, Country")
  function extractCity(address: string, fallbackCity?: string): string {
    if (fallbackCity) return fallbackCity;
    const parts = address.split(",").map((s: string) => s.trim());
    // Israeli addresses: last part is "ישראל"/"Israel", second-to-last may be postal code
    // City is usually the 2nd part for "Street, City, Country" or 2nd for "Street, City, Postal, Country"
    if (parts.length >= 3) {
      // Skip postal codes (digits only)
      const candidate = parts[parts.length - 2];
      if (/^\d+$/.test(candidate) && parts.length >= 4) return parts[parts.length - 3];
      return candidate;
    }
    if (parts.length === 2) return parts[0]; // "City, Country"
    return address;
  }

  const pickupCity = extractCity(pickupRaw.address ?? "", pickupRaw.city);
  const destCity = extractCity(destRaw.address ?? "", destRaw.city);

  const deliveryDoc = {
    senderId: uid,
    senderName,
    senderPhotoUrl,
    senderRating,
    driverId: null,
    status: "new" as DeliveryStatus,
    pickup: {
      address: pickupRaw.address ?? "",
      city: pickupCity,
      lat: pickupLat,
      lng: pickupLng,
      geohash: pickupGeohash,
    },
    destination: {
      address: destRaw.address ?? "",
      city: destCity,
      lat: destLat,
      lng: destLng,
      geohash: destGeohash,
    },
    item: {
      description: itemDescription,
      type: itemType,
      size: itemSize,
      photoURL,
    },
    mediaURLs,
    price,
    pickupDate,
    timeRange,
    notes: d.notes ?? "",
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {},
    statusHistory: [
      {
        status: "new" as DeliveryStatus,
        timestamp: now,
        actor: uid,
        note: "Delivery created",
      },
    ],
    interestedDrivers: [],
    timeoutAt,
    // Expansion tracking — required by notifyExpansion scheduled function
    notifiedDrivers: [],
    notifyRadius: 15,
    notifyExpansionCount: 0,
    lastNotifyExpansion: now,
    createdAt: now,
    updatedAt: now,
  };

  // --- Write to Firestore ---
  const docRef = await db.collection("deliveries").add(deliveryDoc);
  const deliveryId = docRef.id;

  logger.info("Delivery created", { deliveryId, senderId: uid });

  // --- Notify nearby drivers (fire-and-forget — don't block response) ---
  // Uses multi-location matching: checks driver's live GPS, home address, and work address
  if (pickupGeohash) {
    const pickupCity = pickupRaw.city ?? "";
    const destCity = destRaw.city ?? "";
    getNearbyDriverTokensMultiLocation(pickupGeohash, 15, pickupLat, pickupLng, undefined, itemSize || undefined)
      .then(async (nearbyDrivers) => {
        // Exclude the sender from driver notifications
        const driversOnly = nearbyDrivers.filter((d) => d.uid !== uid);
        await Promise.all(
          driversOnly.map((driver) =>
            sendPushNotification(
              driver.uid,
              "משלוח חדש באזורך",
              `משלוח חדש מ-${pickupCity || pickupRaw.address || "איסוף"} ל-${destCity || destRaw.address || "יעד"} - ${price} ₪`,
              {
                event: "new_listing_nearby",
                deliveryId,
                pickupCity,
                destinationCity: destCity,
                price: String(price),
              }
            )
          )
        );
        // Record notified drivers so expansion function skips them (exclude sender)
        if (driversOnly.length > 0) {
          await docRef.update({
            notifiedDrivers: driversOnly.map((d) => d.uid),
          });
        }
        logger.info("createDelivery: notified nearby drivers", { deliveryId, count: driversOnly.length });
      })
      .catch((err) => logger.error("createDelivery: nearby driver notification failed", { deliveryId, error: String(err) }));
  }

  return { success: true, deliveryId };
});

/**
 * Edit an existing delivery.
 * Only the sender can edit, and only when status === 'new' and no drivers have expressed interest.
 * Re-computes geohash if pickup/destination changes.
 */
export const editDelivery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, ...updates } = request.data;
  if (!deliveryId || typeof deliveryId !== "string") {
    throw new HttpsError("invalid-argument", "deliveryId is required");
  }

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Only the sender can edit
  if (delivery.senderId !== uid) {
    throw new HttpsError("permission-denied", "רק השולח יכול לערוך את המשלוח");
  }

  // Only editable when status is 'new'
  if (delivery.status !== "new") {
    throw new HttpsError("failed-precondition", "ניתן לערוך משלוח רק כשהסטטוס הוא חדש");
  }

  // No interested drivers
  const interested: any[] = (delivery as any).interestedDrivers || [];
  const activeInterested = interested.filter((d: any) => d.status !== "withdrawn");
  if (activeInterested.length > 0) {
    throw new HttpsError("failed-precondition", "לא ניתן לערוך משלוח כאשר נהגים כבר הביעו עניין");
  }

  // Build update object
  const updateFields: Record<string, unknown> = {};

  // --- Pickup ---
  if (updates.pickup) {
    const pickupLat = updates.pickup.lat ?? updates.pickup.latitude;
    const pickupLng = updates.pickup.lng ?? updates.pickup.longitude;
    if (typeof pickupLat !== "number" || typeof pickupLng !== "number") {
      throw new HttpsError("invalid-argument", "pickup must have valid lat/lng");
    }
    const pickupGeohash = encodeGeohash(pickupLat, pickupLng, GEOHASH_PRECISION);
    updateFields["pickup"] = {
      address: updates.pickup.address ?? "",
      city: updates.pickup.city ?? "",
      lat: pickupLat,
      lng: pickupLng,
      geohash: pickupGeohash,
    };
  }

  // --- Destination ---
  if (updates.destination) {
    const destLat = updates.destination.lat ?? updates.destination.latitude;
    const destLng = updates.destination.lng ?? updates.destination.longitude;
    if (typeof destLat !== "number" || typeof destLng !== "number") {
      throw new HttpsError("invalid-argument", "destination must have valid lat/lng");
    }
    const destGeohash = encodeGeohash(destLat, destLng, GEOHASH_PRECISION);
    updateFields["destination"] = {
      address: updates.destination.address ?? "",
      city: updates.destination.city ?? "",
      lat: destLat,
      lng: destLng,
      geohash: destGeohash,
    };
  }

  // --- Item ---
  if (updates.itemDescription !== undefined || updates.itemSize !== undefined) {
    const currentItem = delivery.item || {};
    updateFields["item"] = {
      description: updates.itemDescription ?? (currentItem as any).description ?? "",
      type: (currentItem as any).type ?? "general",
      size: updates.itemSize ?? (currentItem as any).size ?? "",
      photoURL: (currentItem as any).photoURL ?? "",
    };
  }

  // --- Price ---
  if (updates.suggestedPrice !== undefined || updates.price !== undefined) {
    const price = typeof updates.price === "number" ? updates.price
      : typeof updates.suggestedPrice === "number" ? updates.suggestedPrice : null;
    if (price !== null) {
      if (price <= 0) {
        throw new HttpsError("invalid-argument", "price must be a positive number");
      }
      updateFields["price"] = price;
    }
  }

  // --- Scheduled date ---
  if (updates.scheduledDate !== undefined) {
    const rawDate = updates.scheduledDate;
    if (!rawDate || rawDate === "asap") {
      updateFields["pickupDate"] = "asap";
    } else if (typeof rawDate === "string") {
      const ms = Date.parse(rawDate);
      if (isNaN(ms)) {
        throw new HttpsError("invalid-argument", "Invalid date format");
      }
      updateFields["pickupDate"] = admin.firestore.Timestamp.fromMillis(ms);
    }
  }

  // --- Time range ---
  if (updates.timeRange !== undefined) {
    const VALID_TIME_RANGES = ["morning", "afternoon", "evening", "night"];
    updateFields["timeRange"] = typeof updates.timeRange === "string" && VALID_TIME_RANGES.includes(updates.timeRange)
      ? updates.timeRange
      : null;
  }

  // --- Notes ---
  if (updates.notes !== undefined) {
    updateFields["notes"] = updates.notes ?? "";
  }

  if (Object.keys(updateFields).length === 0) {
    throw new HttpsError("invalid-argument", "No fields to update");
  }

  // Add status history entry and timestamp
  const now = admin.firestore.Timestamp.now();
  updateFields["updatedAt"] = now;
  updateFields["statusHistory"] = admin.firestore.FieldValue.arrayUnion({
    status: "new" as DeliveryStatus,
    timestamp: now,
    actor: uid,
    note: "Delivery edited by sender",
  });

  await ref.update(updateFields);

  logger.info("Delivery edited", { deliveryId, senderId: uid });

  return { success: true, deliveryId };
});

/**
 * Driver expresses interest in a delivery.
 * Appends driver entry to interestedDrivers array (status stays 'new').
 * Does NOT transition delivery status — sender selects a driver separately.
 */
export const expressInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const driverData = await assertUserRole(db, uid, "driver");
  await assertDriverApproved(db, uid);
  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  if (delivery.status !== "new") {
    throw new HttpsError("failed-precondition", "המשלוח חייב להיות בסטטוס חדש");
  }
  if (delivery.senderId === uid) {
    throw new HttpsError("permission-denied", "לא ניתן להביע עניין במשלוח שלך");
  }

  // Transaction: atomic read-check-append
  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    const interested: any[] = freshData.interestedDrivers || [];

    if (interested.length >= 30) {
      throw new HttpsError("resource-exhausted", "הגעת למקסימום נהגים מעוניינים");
    }

    const existing = interested.find((d: any) => d.uid === uid);
    if (existing) {
      if (existing.status === "withdrawn") {
        // Re-entry after withdrawal
        const updated = interested.map((d: any) =>
          d.uid === uid
            ? { ...d, status: "interested", expressedAt: admin.firestore.Timestamp.now() }
            : d
        );
        txn.update(ref, { interestedDrivers: updated, updatedAt: admin.firestore.Timestamp.now() });
        return;
      }
      throw new HttpsError("already-exists", "כבר הבעת עניין או שנדחית בעבר");
    }

    // Compute distance from pickup
    const pickupLat = freshData.pickup?.lat ?? freshData.pickup?.latitude;
    const pickupLng = freshData.pickup?.lng ?? freshData.pickup?.longitude;
    const driverLat = driverData.location?.lat;
    const driverLng = driverData.location?.lng;
    let distanceKm = 0;
    if (pickupLat && pickupLng && driverLat && driverLng) {
      const R = 6371;
      const dLat = ((driverLat - pickupLat) * Math.PI) / 180;
      const dLon = ((driverLng - pickupLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((pickupLat * Math.PI) / 180) *
          Math.cos((driverLat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const entry = {
      uid,
      name: driverData.nickname || driverData.fullName || "",
      photoUrl: driverData.profilePhotoURL || null,
      rating: driverData.ratingAsDriver?.average ?? 0,
      completedDeliveries: driverData.completedDeliveries ?? 0,
      vehicleType: driverData.driverPrefs?.vehicleType || "car",
      distanceKm: Math.round(distanceKm * 10) / 10,
      expressedAt: admin.firestore.Timestamp.now(),
      status: "interested",
    };

    txn.update(ref, {
      interestedDrivers: [...interested, entry],
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

  // Fire-and-forget: notify sender
  const driverName = driverData.nickname || driverData.fullName || "";
  sendPushNotification(
    delivery.senderId,
    "נהג חדש מעוניין",
    `${driverName} רוצה לאסוף את המשלוח שלך`,
    { event: "driver_interested", deliveryId, driverName }
  ).catch((err: unknown) => logger.error("expressInterest notification failed", { deliveryId, error: String(err) }));

  return { success: true };
});

/**
 * Sender selects a driver from the interested list.
 * Marks the driver as "selected" and sets a 15-minute confirmation window.
 */
export const selectDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId, driverUid } = request.data;
  if (!deliveryId || !driverUid) throw new HttpsError("invalid-argument", "deliveryId and driverUid are required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);
  if (delivery.senderId !== uid) throw new HttpsError("permission-denied", "רק השולח יכול לבחור נהג");

  const SELECTION_TIMEOUT_MS = 15 * 60 * 1000;

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    if (!["new", "pending"].includes(freshData.status)) throw new HttpsError("failed-precondition", "המשלוח חייב להיות בסטטוס חדש או ממתין");
    if (freshData.selectedDriverId) throw new HttpsError("failed-precondition", "נהג אחר כבר נבחר, המתן או בטל");

    const interested: any[] = freshData.interestedDrivers || [];
    const driverEntry = interested.find((d: any) => d.uid === driverUid && d.status === "interested");
    if (!driverEntry) throw new HttpsError("not-found", "הנהג לא נמצא ברשימה או לא זמין");

    const updated = interested.map((d: any) => d.uid === driverUid ? { ...d, status: "selected" } : d);
    const selectedEntry = interested.find((d: any) => d.uid === driverUid);
    const now = admin.firestore.Timestamp.now();

    txn.update(ref, {
      status: "awaiting_confirm",
      driverId: driverUid, // Set early so driver sees it in My Jobs
      driverName: selectedEntry?.name || "",
      driverPhotoUrl: selectedEntry?.photoUrl || null,
      driverRating: selectedEntry?.rating || 0,
      driverVehicleType: selectedEntry?.vehicleType || "car",
      interestedDrivers: updated,
      selectedDriverId: driverUid,
      selectionExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + SELECTION_TIMEOUT_MS),
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "awaiting_confirm",
        timestamp: now,
        actor: uid,
        note: "Sender selected driver, waiting for confirmation",
      }),
      updatedAt: now,
    });
  });

  sendPushNotification(driverUid, "השולח בחר בך!", "אשר את המשלוח תוך 15 דקות", { event: "driver_selected", deliveryId })
    .catch((err: unknown) => logger.error("selectDriver notification failed", { deliveryId, driverUid, error: String(err) }));

  logger.info("Driver selected by sender", { deliveryId, senderId: uid, driverUid });
  return { success: true };
});

/**
 * Selected driver confirms the assignment.
 * Transitions: awaiting_confirm -> waiting_for_pickup. Creates a chat room.
 */
export const confirmSelection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);

  let senderId = "";
  let driverName = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    senderId = freshData.senderId;

    if (freshData.status !== "awaiting_confirm") throw new HttpsError("failed-precondition", "המשלוח חייב להיות בסטטוס ממתין לאישור");
    if (freshData.selectedDriverId !== uid) throw new HttpsError("permission-denied", "אתה לא הנהג שנבחר");

    const expiresAt = freshData.selectionExpiresAt;
    if (expiresAt && expiresAt.toMillis() < Date.now()) throw new HttpsError("deadline-exceeded", "פג תוקף הבחירה");

    const interested: any[] = freshData.interestedDrivers || [];
    const driverEntry = interested.find((d: any) => d.uid === uid);
    driverName = driverEntry?.name || "";

    const updatedInterested = interested.map((d: any) => d.uid === uid ? { ...d, status: "confirmed" } : d);
    const now = admin.firestore.Timestamp.now();

    // Reuse existing chat if delivery previously had one (e.g. driver cancelled and restarted)
    let chatIdToUse: string;
    if (freshData.chatId) {
      chatIdToUse = freshData.chatId;
      txn.update(db.collection("chats").doc(freshData.chatId), { closed: false });
    } else {
      const chatRef = db.collection("chats").doc();
      chatIdToUse = chatRef.id;
      txn.set(chatRef, {
        deliveryId,
        participants: [freshData.senderId, uid],
        lastMessage: "",
        lastMessageAt: now,
        lastSenderId: "",
        createdAt: now,
        closed: false,
      });
    }

    txn.update(ref, {
      status: "waiting_for_pickup",
      driverId: uid,
      driverName: driverEntry?.name || "",
      driverPhotoUrl: driverEntry?.photoUrl || null,
      driverRating: driverEntry?.rating || 0,
      interestedDrivers: updatedInterested,
      selectedDriverId: null,
      selectionExpiresAt: null,
      chatId: chatIdToUse,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "waiting_for_pickup",
        timestamp: now,
        actor: uid,
        note: "Driver confirmed selection",
      }),
      updatedAt: now,
    });
  });

  sendPushNotification(senderId, "הנהג אישר!", `המשלוח שויך ל-${driverName}`, { event: "driver_confirmed", deliveryId })
    .catch((err: unknown) => logger.error("confirmSelection notification failed", { deliveryId, error: String(err) }));

  // Notify non-selected interested drivers — only now that a driver has confirmed
  try {
    const deliverySnap = await db.collection("deliveries").doc(deliveryId).get();
    const deliveryData = deliverySnap.data();
    const interestedDrivers: any[] = deliveryData?.interestedDrivers || [];
    const rejectedDriverIds = interestedDrivers
      .filter((d: any) => d.uid !== uid && d.status !== "withdrawn" && d.status !== "cancelled")
      .map((d: any) => d.uid as string);

    await Promise.all(
      rejectedDriverIds.map((driverId: string) =>
        sendPushNotification(
          driverId,
          "המשלוח נלקח",
          "נהג אחר קיבל את המשלוח הזה",
          { event: "delivery_taken", deliveryId }
        ).catch((err: unknown) => logger.warn("rejection notification failed", { driverId, error: String(err) }))
      )
    );
    if (rejectedDriverIds.length > 0) {
      logger.info("Notified rejected drivers after selection confirmed", { deliveryId, count: rejectedDriverIds.length });
    }
  } catch (err) {
    logger.warn("Failed to notify rejected drivers", { deliveryId, error: String(err) });
  }

  logger.info("Driver confirmed selection", { deliveryId, driverId: uid });
  return { success: true };
});

/**
 * Selected driver declines the assignment.
 * Resets selectedDriverId so sender can choose another driver.
 */
export const declineSelection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);
  let senderId = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    senderId = freshData.senderId;

    if (freshData.selectedDriverId !== uid) throw new HttpsError("permission-denied", "אתה לא הנהג שנבחר");

    const now = admin.firestore.Timestamp.now();
    const interested: any[] = freshData.interestedDrivers || [];
    const updated = interested.map((d: any) => d.uid === uid ? { ...d, status: "declined" } : d);

    txn.update(ref, {
      status: "new",
      driverId: null,
      driverName: null,
      driverPhotoUrl: null,
      driverRating: null,
      interestedDrivers: updated,
      selectedDriverId: null,
      selectionExpiresAt: null,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "new",
        timestamp: now,
        actor: uid,
        note: "Driver declined selection, reverted to new",
      }),
      updatedAt: now,
    });
  });

  sendPushNotification(senderId, "הנהג דחה", "בחר נהג אחר מהרשימה", { event: "driver_declined", deliveryId })
    .catch((err: unknown) => logger.error("declineSelection notification failed", { deliveryId, error: String(err) }));

  // Re-notify nearby drivers (exclude the declined driver)
  renotifyNearbyDrivers(delivery, deliveryId, [uid], "declineSelection");

  logger.info("Driver declined selection", { deliveryId, driverId: uid });
  return { success: true };
});

/**
 * Sender cancels a selected or confirmed driver.
 * Reverts delivery back to 'pending' so other drivers can be selected.
 */
export const cancelSelectedDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);
  let cancelledDriverId = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    if (freshData.senderId !== uid) throw new HttpsError("permission-denied", "רק השולח יכול לבטל");

    const now = admin.firestore.Timestamp.now();
    const interested: any[] = freshData.interestedDrivers || [];

    if (freshData.status === "awaiting_confirm" && freshData.selectedDriverId) {
      // Case 1: Cancel pending selection (driver hasn't confirmed yet)
      cancelledDriverId = freshData.selectedDriverId;
      const updated = interested.map((d: any) =>
        d.uid === cancelledDriverId ? { ...d, status: "cancelled" } : d
      );
      txn.update(ref, {
        status: "new",
        driverId: null,
        driverName: null,
        driverPhotoUrl: null,
        driverRating: null,
        interestedDrivers: updated,
        selectedDriverId: null,
        selectionExpiresAt: null,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "new",
          timestamp: now,
          actor: uid,
          note: "Sender cancelled pending selection, reverted to new",
        }),
        updatedAt: now,
      });
    } else if (freshData.status === "waiting_for_pickup" && freshData.driverId) {
      // Case 2: Cancel confirmed driver (revert waiting_for_pickup → new)
      cancelledDriverId = freshData.driverId;
      const updated = interested.map((d: any) =>
        d.uid === cancelledDriverId ? { ...d, status: "cancelled" } : d
      );
      txn.update(ref, {
        status: "new",
        driverId: null,
        driverName: null,
        driverPhotoUrl: null,
        driverRating: null,
        interestedDrivers: updated,
        selectedDriverId: null,
        selectionExpiresAt: null,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "new",
          timestamp: now,
          actor: uid,
          note: "Sender cancelled confirmed driver, reverted to new",
        }),
        updatedAt: now,
      });
    } else {
      throw new HttpsError("failed-precondition", "אין בחירה ממתינה או נהג משויך לביטול");
    }
  });

  sendPushNotification(cancelledDriverId, "השולח ביטל את הבחירה", "המשלוח הוחזר לרשימה", { event: "selection_cancelled", deliveryId })
    .catch((err: unknown) => logger.error("cancelSelectedDriver notification failed", { deliveryId, error: String(err) }));

  // Re-notify nearby drivers (exclude the cancelled driver and sender)
  renotifyNearbyDrivers(delivery, deliveryId, [cancelledDriverId, uid], "cancelSelectedDriver");

  logger.info("Sender cancelled selected driver", { deliveryId, senderId: uid, cancelledDriverId });
  return { success: true };
});

/**
 * Driver removes themselves from the interested list.
 * Only allowed while their status is still "interested" (not selected/confirmed).
 */
export const withdrawFromInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    const interested: any[] = freshData.interestedDrivers || [];
    const entry = interested.find((d: any) => d.uid === uid);

    if (!entry || entry.status !== "interested") {
      throw new HttpsError("failed-precondition", "לא נמצא ברשימה או כבר נבחר/נדחה");
    }

    const updated = interested.map((d: any) => d.uid === uid ? { ...d, status: "withdrawn" } : d);

    txn.update(ref, {
      interestedDrivers: updated,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

  logger.info("Driver withdrew from interest", { deliveryId, driverId: uid });
  return { success: true };
});

/**
 * Sender approves a driver for a delivery.
 * Transitions: pending -> waiting_for_pickup
 * Creates a chat room between sender and driver.
 * Denormalizes sender info onto the delivery document.
 */
export const approveDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  logger.info("Sender approving driver", { deliveryId, senderId: uid });
  await assertUserRole(db, uid, "sender");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the sender
  assertIsSender(delivery.senderId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "waiting_for_pickup", "sender", uid);

  if (!delivery.driverId) {
    throw new HttpsError(
      "failed-precondition",
      "No driver has expressed interest yet"
    );
  }

  // Lookup sender info for denormalization
  const senderDoc = await db.collection("users").doc(uid).get();
  const senderData = senderDoc.data();
  const senderName = senderData?.nickname || senderData?.fullName || "";
  const senderPhotoUrl = senderData?.profilePhotoURL || "";
  const senderRating = senderData?.ratingAsSender?.average ?? null;

  const now = admin.firestore.Timestamp.now();
  let chatId: string;

  if (delivery.chatId) {
    // Reopen existing chat (delivery previously had one — e.g. after driver cancel/revert)
    chatId = delivery.chatId;
    await db.collection("chats").doc(chatId).update({ closed: false });
  } else {
    // Create new chat room between sender and driver
    const chatRef = db.collection("chats").doc();
    chatId = chatRef.id;
    await chatRef.set({
      deliveryId,
      participants: [uid, delivery.driverId],
      senderName,
      driverName: delivery.driverName || "",
      lastMessage: "צ'אט נוצר — משלוח אושר",
      lastMessageAt: now,
      closed: false,
      createdAt: now,
    });
    await chatRef.collection("messages").add({
      type: "system",
      text: "✅ המשלוח אושר — אפשר לתאם איסוף",
      senderId: "system",
      createdAt: now,
    });
  }

  await updateDeliveryStatus(
    ref,
    "waiting_for_pickup",
    uid,
    "Sender approved driver",
    {
      chatId,
      senderName,
      senderPhotoUrl,
      senderRating,
    }
  );

  // Notify the driver
  await sendDeliveryNotification(deliveryId, "sender_approved", {
    actorId: uid,
  });

  return { success: true, message: "Driver approved successfully" };
});

/**
 * Driver confirms pickup of the item.
 * Transitions: waiting -> picked_up
 * Requires proof photo URL.
 */
export const confirmPickup = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, pickupPhotoURL } = request.data;

  if (!pickupPhotoURL || typeof pickupPhotoURL !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "pickupPhotoURL is required as proof of pickup"
    );
  }

  await assertUserRole(db, uid, "driver");
  await assertDriverApproved(db, uid);

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the assigned driver
  assertIsDriver(delivery.driverId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "picked_up", "driver", uid);

  await updateDeliveryStatus(
    ref,
    "picked_up",
    uid,
    "Driver confirmed pickup",
    {
      "proof.pickupURL": pickupPhotoURL,
    }
  );

  // Notify the sender
  await sendDeliveryNotification(deliveryId, "delivery_picked_up", {
    actorId: uid,
  });

  return { success: true, message: "Pickup confirmed successfully" };
});

/**
 * Driver confirms delivery of the item.
 * Transitions: picked_up -> delivered
 * Requires proof photo URL.
 */
export const confirmDelivery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, deliveryPhotoURL } = request.data;

  if (!deliveryPhotoURL || typeof deliveryPhotoURL !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "deliveryPhotoURL is required as proof of delivery"
    );
  }

  await assertUserRole(db, uid, "driver");
  await assertDriverApproved(db, uid);

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the assigned driver
  assertIsDriver(delivery.driverId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "delivered", "driver", uid);

  await updateDeliveryStatus(
    ref,
    "delivered",
    uid,
    "Driver confirmed delivery",
    {
      "proof.deliveryURL": deliveryPhotoURL,
    }
  );

  // Notify the sender
  await sendDeliveryNotification(deliveryId, "delivery_delivered", {
    actorId: uid,
  });

  return { success: true, message: "Delivery confirmed successfully" };
});

/**
 * Either party confirms payment has been sent/received.
 * First confirm: delivered -> awaiting_payment
 * Second confirm: awaiting_payment -> completed_paid
 */
export const confirmPayment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, paymentPhotoURL } = request.data;
  const { ref } = await getDeliveryOrThrow(deliveryId);

  // Use a single transaction for ALL payment confirmations to prevent race conditions.
  // Without this, two simultaneous callers could both read otherConfirmed=false and
  // both transition to awaiting_payment instead of one going to completed_paid.
  let notifyEvent: "awaiting_payment_notify" | "payment_confirmed" | null = null;

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const delivery = freshDoc.data() as Delivery;

    if (!delivery) throw new HttpsError("not-found", `Delivery ${deliveryId} not found`);

    // Allow payment confirmation in both delivered and awaiting_payment
    if (delivery.status !== "delivered" && delivery.status !== "awaiting_payment") {
      throw new HttpsError(
        "failed-precondition",
        "Payment can only be confirmed when status is 'delivered' or 'awaiting_payment'"
      );
    }

    const isSender = delivery.senderId === uid;
    const isDriver = delivery.driverId === uid;

    if (!isSender && !isDriver) {
      throw new HttpsError(
        "permission-denied",
        "Only the sender or driver can confirm payment"
      );
    }

    // Check for double-confirm
    if (isSender && delivery.payment.senderConfirmed) {
      throw new HttpsError("already-exists", "Sender has already confirmed payment");
    }
    if (isDriver && delivery.payment.driverConfirmed) {
      throw new HttpsError("already-exists", "Driver has already confirmed payment");
    }

    const now = admin.firestore.Timestamp.now();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    // Set the caller's confirmation flag
    if (isSender) {
      updateData["payment.senderConfirmed"] = true;
    }
    if (isDriver) {
      updateData["payment.driverConfirmed"] = true;
    }

    // Store payment proof photo if provided
    if (paymentPhotoURL && typeof paymentPhotoURL === "string") {
      updateData["proof.paymentURL"] = paymentPhotoURL;
    }

    // Determine if this is the first or second confirmation (fresh read inside txn)
    const otherConfirmed = isSender
      ? delivery.payment.driverConfirmed
      : delivery.payment.senderConfirmed;

    if (!otherConfirmed) {
      // FIRST confirmation → transition to awaiting_payment
      updateData.status = "awaiting_payment";
      updateData.statusHistory = admin.firestore.FieldValue.arrayUnion({
        status: "awaiting_payment",
        timestamp: now,
        actor: uid,
        note: `${isSender ? "Sender" : "Driver"} confirmed payment, waiting for other party`,
      });

      txn.update(ref, updateData);
      notifyEvent = "awaiting_payment_notify";
    } else {
      // SECOND confirmation → transition to completed_paid
      const completionEntry = {
        status: "completed_paid" as const,
        timestamp: now,
        actor: uid,
        note: "Both parties confirmed payment",
      };

      txn.update(ref, {
        ...updateData,
        status: "completed_paid",
        statusHistory: admin.firestore.FieldValue.arrayUnion(completionEntry),
      });

      // Increment completedDeliveries for both users
      if (delivery.senderId) {
        txn.update(db.collection("users").doc(delivery.senderId), {
          completedDeliveries: admin.firestore.FieldValue.increment(1),
        });
      }
      if (delivery.driverId) {
        txn.update(db.collection("users").doc(delivery.driverId), {
          completedDeliveries: admin.firestore.FieldValue.increment(1),
        });
      }
      notifyEvent = "payment_confirmed";
    }
  });

  // Send notifications outside the transaction
  if (notifyEvent === "awaiting_payment_notify") {
    await sendDeliveryNotification(deliveryId, "awaiting_payment_notify", { actorId: uid });
  } else if (notifyEvent === "payment_confirmed") {
    await sendDeliveryNotification(deliveryId, "payment_confirmed", { actorId: uid });
  }

  return { success: true, message: "Payment confirmation recorded" };
});

/**
 * Cancel a delivery.
 * Only allowed before pickup (status: new, pending, awaiting_confirm, waiting_for_pickup).
 */
export const cancelDelivery = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, reason } = request.data;
  const { ref } = await getDeliveryOrThrow(deliveryId);

  let cancellerNameHe = "";
  let driverCancelled = false;
  let withinSelectionWindow = false;
  let deliverySnapshot: Delivery | null = null;

  // Use transaction to prevent race conditions (e.g. cancel + confirm at same time)
  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const delivery = freshDoc.data() as Delivery;
    if (!delivery) throw new HttpsError("not-found", `Delivery ${deliveryId} not found`);
    deliverySnapshot = delivery;

    // Verify the caller is either the sender or the assigned driver.
    // Also accept selectedDriverId in case driverId was cleared by a selection-timer expiry
    // while the driver's UI snapshot was stale — prevents spurious permission-denied errors.
    const isSender = delivery.senderId === uid;
    const isDriver = delivery.driverId === uid || delivery.selectedDriverId === uid;

    if (!isSender && !isDriver) {
      throw new HttpsError(
        "permission-denied",
        "Only the sender or assigned driver can cancel this delivery"
      );
    }

    const actorRole = isSender ? "sender" : "driver";
    cancellerNameHe = isSender ? "השולח" : "הנהג";
    driverCancelled = isDriver && !isSender;

    const now = admin.firestore.Timestamp.now();

    if (driverCancelled) {
      // ── DRIVER cancels pre-pickup: revert to "new" ──

      // If a selection timer already reverted the delivery to "new", the driver only
      // needs to mark themselves as cancelled in interestedDrivers — no status change.
      if (delivery.status === "new") {
        const interested: any[] = delivery.interestedDrivers || [];
        const updated = interested.map((d: any) =>
          d.uid === uid ? { ...d, status: "cancelled" } : d
        );
        txn.update(ref, { interestedDrivers: updated, updatedAt: now });
        return;
      }

      assertValidTransition(delivery.status, "new", actorRole, uid);

      // 30-minute window: if driver cancels quickly, other interested drivers are
      // preserved so the sender can re-select without a full broadcast.
      const selectionMs = (delivery.updatedAt as admin.firestore.Timestamp)?.toMillis?.() ?? Date.now();
      withinSelectionWindow = Date.now() - selectionMs < 30 * 60 * 1000;

      const interested: any[] = delivery.interestedDrivers || [];
      const updatedInterested = interested.map((d: any) =>
        d.uid === uid ? { ...d, status: "cancelled" } : d
      );

      txn.update(ref, {
        status: "new",
        driverId: null,
        driverName: null,
        driverPhotoUrl: null,
        driverRating: null,
        selectedDriverId: null,
        selectionExpiresAt: null,
        // Keep other interested drivers within the 30-min window; clear after.
        interestedDrivers: withinSelectionWindow ? updatedInterested : [],
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "new",
          timestamp: now,
          actor: uid,
          note: reason ?? "Driver cancelled — delivery returned to new",
        }),
        updatedAt: now,
      });
    } else {
      // ── SENDER cancels: truly cancel the delivery ──
      assertValidTransition(delivery.status, "cancelled", actorRole, uid);

      txn.update(ref, {
        status: "cancelled",
        cancelledBy: uid,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancelled",
          timestamp: now,
          actor: uid,
          note: reason ?? "Cancelled by sender",
        }),
        updatedAt: now,
      });
    }
  });

  if (driverCancelled && deliverySnapshot) {
    // Notify sender that driver cancelled
    try {
      await sendPushNotification(
        (deliverySnapshot as Delivery).senderId,
        "הנהג ביטל את המשלוח",
        "הנהג ביטל — המשלוח חוזר לרשימה ופתוח לנהגים חדשים",
        { event: "driver_cancelled", deliveryId }
      );
    } catch (err) {
      logger.error("cancelDelivery: sender notification failed", { deliveryId, error: String(err) });
    }

    // Send chat message to sender about the cancellation
    try {
      const chatId = (deliverySnapshot as Delivery).chatId;
      if (chatId) {
        await admin.firestore().collection("chats").doc(chatId).collection("messages").add({
          senderId: "system",
          senderName: "מערכת",
          text: "הנהג ביטל את המשלוח. המשלוח חוזר לרשימה ופתוח לנהגים חדשים. הצ'אט יישאר פתוח 8 שעות.",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          type: "system",
        });
        // Keep chat open for 8 hours
        const closeAt = admin.firestore.Timestamp.fromMillis(
          Date.now() + 8 * 60 * 60 * 1000
        );
        await admin.firestore().collection("chats").doc(chatId).update({
          closed: false,
          chatCloseAt: closeAt,
        });
      }
    } catch (err) {
      logger.error("cancelDelivery: chat message failed", { deliveryId, error: String(err) });
    }

    // Within the 30-min window: notify previously interested drivers that the
    // delivery is available again so they can still be selected by the sender.
    if (withinSelectionWindow) {
      const prevInterested: any[] = (deliverySnapshot as Delivery).interestedDrivers?.filter(
        (d: any) => d.uid !== uid && ["interested", "confirmed"].includes(d.status)
      ) ?? [];
      await Promise.allSettled(
        prevInterested.map((d: any) =>
          sendPushNotification(
            d.uid,
            "משלוח זמין שוב",
            "משלוח שהתעניינת בו חזר לרשימה — השולח יכול עדיין לבחור אותך",
            { event: "delivery_reopened", deliveryId }
          )
        )
      );
    }

    // Broadcast to all nearby drivers (always, so new drivers can also see it)
    renotifyNearbyDrivers(deliverySnapshot as Delivery, deliveryId, [uid], "cancelDelivery");
  } else {
    // Sender cancelled — notify driver and close chat
    await sendDeliveryNotification(deliveryId, "delivery_cancelled", {
      actorId: uid,
      cancelledBy: cancellerNameHe,
    });

    // Send chat message to driver about sender cancellation
    if (deliverySnapshot) {
      try {
        const chatId = (deliverySnapshot as Delivery).chatId;
        if (chatId) {
          await admin.firestore().collection("chats").doc(chatId).collection("messages").add({
            senderId: "system",
            senderName: "מערכת",
            text: "השולח ביטל את המשלוח.",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: "system",
          });
        }
      } catch (err) {
        logger.error("cancelDelivery: chat message for sender cancel failed", { deliveryId, error: String(err) });
      }
    }
  }

  return { success: true, message: driverCancelled ? "Delivery returned to new" : "Delivery cancelled" };
});

/**
 * Sender declines an interested driver.
 * Transitions: pending -> new (resets driver assignment)
 */
export const declineDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify caller is the sender
  assertIsSender(delivery.senderId, uid);

  // Validate transition: pending → new (sender declines the driver)
  assertValidTransition(delivery.status, "new", "sender", uid);

  const declinedDriverId = delivery.driverId;

  await updateDeliveryStatus(
    ref,
    "new",
    uid,
    "Sender declined driver",
    { driverId: null }
  );

  // Notify the declined driver
  if (declinedDriverId) {
    await sendPushNotification(
      declinedDriverId,
      "השולח בחר נהג אחר",
      "השולח בחר נהג אחר למשלוח זה",
      { event: "driver_declined", deliveryId }
    );
  }

  return { success: true, message: "Driver declined successfully" };
});

/**
 * Driver withdraws their interest from a delivery.
 * Transitions: pending -> new (resets driver assignment)
 * Re-notifies nearby drivers about the available delivery.
 */
export const withdrawInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId } = request.data;
  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Verify the caller is the assigned driver
  assertIsDriver(delivery.driverId, uid);

  // Validate transition
  assertValidTransition(delivery.status, "new", "driver", uid);

  logger.info("Driver withdrawing interest", { deliveryId, driverId: uid });

  await updateDeliveryStatus(
    ref,
    "new",
    uid,
    "Driver withdrew interest",
    {
      driverId: null,
      driverName: null,
      driverPhotoUrl: null,
      driverRating: null,
    }
  );

  // Notify the sender
  try {
    await sendPushNotification(
      delivery.senderId,
      "הנהג ביטל את ההתעניינות",
      "הנהג ביטל את ההתעניינות במשלוח שלך",
      { event: "driver_withdrew", deliveryId }
    );
  } catch (notifErr: unknown) {
    logger.error("withdrawInterest: sender notification failed", { deliveryId, error: String(notifErr) });
  }

  // Re-notify nearby drivers (exclude the withdrawing driver)
  renotifyNearbyDrivers(delivery, deliveryId, [uid], "withdrawInterest");

  return { success: true };
});

/**
 * Submit a rating for the other party after delivery.
 * Validates caller is sender or driver, delivery is delivered/completed_paid,
 * and the caller hasn't already rated. Uses a transaction for atomic aggregate updates.
 */
export const submitRating = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { deliveryId, rating, comment } = request.data;

  // Validate rating value
  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new HttpsError("invalid-argument", "Rating must be an integer between 1 and 5");
  }

  if (comment !== undefined && typeof comment !== "string") {
    throw new HttpsError("invalid-argument", "Comment must be a string");
  }

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Validate delivery status — allow rating during all post-delivery states
  const ratingAllowedStatuses = ["delivered", "awaiting_payment", "completed_paid"];
  if (!ratingAllowedStatuses.includes(delivery.status)) {
    throw new HttpsError(
      "failed-precondition",
      "Ratings can only be submitted after delivery is completed"
    );
  }

  // Determine caller's role in this delivery
  const isSender = delivery.senderId === uid;
  const isDriver = delivery.driverId === uid;

  if (!isSender && !isDriver) {
    throw new HttpsError(
      "permission-denied",
      "Only the sender or driver of this delivery can submit a rating"
    );
  }

  // Check if already rated
  if (isSender && delivery.ratedBySender) {
    throw new HttpsError("already-exists", "Sender has already rated this delivery");
  }
  if (isDriver && delivery.ratedByDriver) {
    throw new HttpsError("already-exists", "Driver has already rated this delivery");
  }

  const callerRole = isSender ? "sender" : "driver";
  const targetUserId = isSender ? delivery.driverId! : delivery.senderId;
  const now = admin.firestore.Timestamp.now();

  // Determine which aggregate field to update on the target user
  // Sender rates the driver -> update ratingAsDriver
  // Driver rates the sender -> update ratingAsSender
  const ratingField = isSender ? "ratingAsDriver" : "ratingAsSender";

  // Check if the other party has already rated
  const otherRated = isSender ? !!delivery.ratedByDriver : !!delivery.ratedBySender;
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const ratingsVisibleAt = otherRated
    ? now
    : admin.firestore.Timestamp.fromMillis(now.toMillis() + FIVE_DAYS_MS);

  // Use a transaction to atomically update the target user's aggregate rating
  await db.runTransaction(async (transaction) => {
    const targetUserRef = db.collection("users").doc(targetUserId);
    const targetUserDoc = await transaction.get(targetUserRef);

    if (!targetUserDoc.exists) {
      throw new HttpsError("not-found", `Target user ${targetUserId} not found`);
    }

    const targetUserData = targetUserDoc.data()!;
    const currentRating = targetUserData[ratingField] ?? { average: 0, count: 0 };
    const currentAvg: number = currentRating.average ?? 0;
    const currentCount: number = currentRating.count ?? 0;

    // Recalculate average
    const newCount = currentCount + 1;
    const newAverage = ((currentAvg * currentCount) + rating) / newCount;

    // Update target user's aggregate rating
    transaction.update(targetUserRef, {
      [ratingField]: {
        average: Math.round(newAverage * 100) / 100, // round to 2 decimal places
        count: newCount,
      },
    });

    // Create rating document
    const ratingDocRef = db.collection("ratings").doc();
    transaction.set(ratingDocRef, {
      deliveryId,
      fromUserId: uid,
      targetUserId,
      rating,
      comment: comment ?? "",
      role: callerRole,
      createdAt: now,
    });

    // Update delivery document — include rating summary for card display
    const deliveryUpdate: Record<string, unknown> = {
      updatedAt: now,
      ratingsVisibleAt,
    };
    // Store rating summary on delivery doc (for card/detail display without extra queries)
    const ratingSummaryKey = isSender ? "senderRatingGiven" : "driverRatingGiven";
    deliveryUpdate[ratingSummaryKey] = {
      rating,
      comment: (comment ?? "").slice(0, 100),
    };
    if (isSender) {
      deliveryUpdate.ratedBySender = true;
    } else {
      deliveryUpdate.ratedByDriver = true;
    }
    // If both have now rated, update ratingsVisibleAt to now
    if (otherRated) {
      deliveryUpdate.ratingsVisibleAt = now;
    }
    transaction.update(ref, deliveryUpdate);
  });

  logger.info("Rating submitted", { deliveryId, callerRole, fromUserId: uid, targetUserId, rating });

  return { success: true };
});
