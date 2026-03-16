import * as admin from "firebase-admin";
import { isDriverAvailableNow } from "../utils/timeUtils";

const db = admin.firestore();

/**
 * Geohash precision levels and their approximate cell dimensions:
 * 1: ~5,000km x 5,000km
 * 2: ~1,250km x 625km
 * 3: ~156km x 156km
 * 4: ~39km x 19.5km
 * 5: ~4.9km x 4.9km
 * 6: ~1.2km x 0.6km
 */

// Base32 character set for geohash encoding
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encode latitude/longitude into a geohash string.
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 6): string {
  let latRange = { min: -90, max: 90 };
  let lonRange = { min: -180, max: 180 };
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isEven = true;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonRange.min + lonRange.max) / 2;
      if (longitude >= mid) {
        ch |= 1 << (4 - bit);
        lonRange.min = mid;
      } else {
        lonRange.max = mid;
      }
    } else {
      const mid = (latRange.min + latRange.max) / 2;
      if (latitude >= mid) {
        ch |= 1 << (4 - bit);
        latRange.min = mid;
      } else {
        latRange.max = mid;
      }
    }

    isEven = !isEven;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Determine the geohash precision to use based on a given radius in km.
 */
function getPrecisionForRadius(radiusKm: number): number {
  if (radiusKm <= 1) return 6;
  if (radiusKm <= 5) return 5;
  if (radiusKm <= 20) return 4;
  if (radiusKm <= 100) return 3;
  return 2;
}

/**
 * Get the neighboring geohash prefixes for a given geohash at a specific precision.
 * This is a simplified approach that queries by prefix range.
 */
function getGeohashRange(geohash: string, precision: number): { lower: string; upper: string } {
  const prefix = geohash.substring(0, precision);
  // Create upper bound by incrementing the last character
  const lastChar = prefix.charAt(prefix.length - 1);
  const upperPrefix = prefix.substring(0, prefix.length - 1) + String.fromCharCode(lastChar.charCodeAt(0) + 1);
  return { lower: prefix, upper: upperPrefix };
}

/**
 * Calculate the Haversine distance between two points in km.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface NearbyDriver {
  uid: string;
  fcmToken: string;
  distanceKm: number;
}

/**
 * Query for nearby active drivers with valid FCM tokens within a given radius.
 * Uses geohash prefix filtering followed by precise Haversine distance calculation.
 */
export async function getNearbyDriverTokens(
  geohash: string,
  radiusKm: number,
  centerLat?: number,
  centerLng?: number
): Promise<NearbyDriver[]> {
  const precision = getPrecisionForRadius(radiusKm);
  const { lower, upper } = getGeohashRange(geohash, precision);

  // Query approved drivers in the geohash range
  // Uses driverUnlocked (set when KYC is approved) instead of role,
  // since all users register with role='sender' even after becoming drivers.
  const snapshot = await db
    .collection("users")
    .where("driverUnlocked", "==", true)
    .where("status", "==", "active")
    .where("location.geohash", ">=", lower)
    .where("location.geohash", "<", upper)
    .get();

  if (snapshot.empty) {
    return [];
  }

  const drivers: NearbyDriver[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const tokens = data.fcmTokens;
    const fcmToken = Array.isArray(tokens) ? tokens[tokens.length - 1] : tokens;

    // Skip drivers without FCM tokens
    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.length === 0) {
      continue;
    }

    let distanceKm = 0;

    // If center coordinates are provided, do precise distance filtering
    if (centerLat !== undefined && centerLng !== undefined) {
      const driverLat = data.location?.lat;
      const driverLng = data.location?.lng;

      if (typeof driverLat !== "number" || typeof driverLng !== "number") {
        continue;
      }

      distanceKm = haversineDistance(centerLat, centerLng, driverLat, driverLng);

      // Skip if outside the actual radius
      if (distanceKm > radiusKm) {
        continue;
      }
    }

    drivers.push({
      uid: doc.id,
      fcmToken,
      distanceKm,
    });
  }

  // Sort by distance (closest first)
  drivers.sort((a, b) => a.distanceKm - b.distanceKm);

  return drivers;
}

/** Max radius a driver can set in app preferences (slider max) */
const MAX_DRIVER_RADIUS_KM = 50;

/** Default radius when driver has no preference set */
const DEFAULT_DRIVER_RADIUS_KM = 10;

/**
 * Extended nearby driver query that checks 3 locations per driver:
 * 1. Live GPS location
 * 2. Home address from driverPrefs
 * 3. Work address from driverPrefs
 *
 * Uses the DRIVER's own radiusKm preference as the effective distance threshold.
 * Example: driver sets radar to 20km, delivery is 10km from their home → notified.
 *
 * The geohash query uses the max possible driver radius (50km) to ensure
 * we don't miss drivers who set a large radius preference.
 *
 * Deduplicates by UID (closest match wins).
 * Filters by schedule, quiet hours, size preference, and driverAvailable toggle.
 */
export async function getNearbyDriverTokensMultiLocation(
  pickupGeohash: string,
  radiusKm: number,
  centerLat: number,
  centerLng: number,
  excludeUids?: string[],
  itemSize?: string
): Promise<NearbyDriver[]> {
  // Use the wider of delivery radius vs max driver radius for the geohash query,
  // so we capture all drivers who might be within their own preferred radius.
  const queryRadius = Math.max(radiusKm, MAX_DRIVER_RADIUS_KM);
  const precision = getPrecisionForRadius(queryRadius);
  const { lower, upper } = getGeohashRange(pickupGeohash, precision);
  const excludeSet = new Set(excludeUids || []);

  // Run 3 parallel queries: live location, home address, work address
  const [liveSnap, homeSnap, workSnap] = await Promise.all([
    db.collection("users")
      .where("driverUnlocked", "==", true)
      .where("status", "==", "active")
      .where("location.geohash", ">=", lower)
      .where("location.geohash", "<", upper)
      .get(),
    db.collection("users")
      .where("driverUnlocked", "==", true)
      .where("status", "==", "active")
      .where("driverPrefs.homeAddress.geohash", ">=", lower)
      .where("driverPrefs.homeAddress.geohash", "<", upper)
      .get(),
    db.collection("users")
      .where("driverUnlocked", "==", true)
      .where("status", "==", "active")
      .where("driverPrefs.workAddress.geohash", ">=", lower)
      .where("driverPrefs.workAddress.geohash", "<", upper)
      .get(),
  ]);

  // Merge all results, deduplicate by UID (keep closest distance)
  const driverMap = new Map<string, NearbyDriver>();

  const processDoc = (
    doc: FirebaseFirestore.QueryDocumentSnapshot,
    locType: "live" | "home" | "work"
  ) => {
    const uid = doc.id;
    if (excludeSet.has(uid)) return;

    const data = doc.data();
    const tokens = data.fcmTokens;
    const fcmToken = Array.isArray(tokens) ? tokens[tokens.length - 1] : tokens;
    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.length === 0) return;

    // Check driverAvailable toggle
    if (data.driverAvailable === false) {
      console.log(`[geohash] Skipping driver ${uid} (${locType}): driverAvailable=false`);
      return;
    }

    // Check schedule + quiet hours
    const prefs = data.driverPrefs;
    if (prefs && !isDriverAvailableNow(prefs)) {
      console.log(`[geohash] Skipping driver ${uid} (${locType}): schedule/quiet hours`);
      return;
    }

    // Filter by delivery size preference (case-insensitive)
    if (itemSize) {
      const sizes = prefs?.deliverySizes;
      if (Array.isArray(sizes) && sizes.length > 0) {
        const normalizedItem = itemSize.toLowerCase();
        const match = sizes.some((s: string) => s.toLowerCase() === normalizedItem);
        if (!match) {
          console.log(
            `[geohash] Skipping driver ${uid} (${locType}): size mismatch — ` +
            `delivery="${itemSize}", driver accepts=${JSON.stringify(sizes)}`
          );
          return;
        }
      }
    }

    // Get coordinates based on location type
    let driverLat: number | undefined;
    let driverLng: number | undefined;

    if (locType === "live") {
      driverLat = data.location?.lat;
      driverLng = data.location?.lng;
    } else if (locType === "home") {
      driverLat = prefs?.homeAddress?.lat;
      driverLng = prefs?.homeAddress?.lng;
    } else {
      driverLat = prefs?.workAddress?.lat;
      driverLng = prefs?.workAddress?.lng;
    }

    if (typeof driverLat !== "number" || typeof driverLng !== "number") return;

    const distanceKm = haversineDistance(centerLat, centerLng, driverLat, driverLng);

    // Use the larger of: delivery's notification radius OR driver's own radar radius.
    // This ensures a driver with 30km radar gets notified for a delivery 25km away,
    // even if the delivery's expansion is still at 15km.
    const driverRadiusKm: number = prefs?.radiusKm ?? DEFAULT_DRIVER_RADIUS_KM;
    const effectiveRadius = Math.max(radiusKm, driverRadiusKm);

    if (distanceKm > effectiveRadius) {
      console.log(
        `[geohash] Skipping driver ${uid} (${locType}): ` +
        `distance=${distanceKm.toFixed(1)}km > effective=${effectiveRadius}km ` +
        `(delivery=${radiusKm}km, driver=${driverRadiusKm}km)`
      );
      return;
    }

    const existing = driverMap.get(uid);
    if (!existing || distanceKm < existing.distanceKm) {
      driverMap.set(uid, { uid, fcmToken, distanceKm });
    }
  };

  for (const doc of liveSnap.docs) processDoc(doc, "live");
  for (const doc of homeSnap.docs) processDoc(doc, "home");
  for (const doc of workSnap.docs) processDoc(doc, "work");

  const drivers = Array.from(driverMap.values());
  drivers.sort((a, b) => a.distanceKm - b.distanceKm);

  console.log(
    `[geohash] Multi-location query: deliveryRadius=${radiusKm}km, queryRadius=${queryRadius}km, ` +
    `candidates: live=${liveSnap.size} home=${homeSnap.size} work=${workSnap.size}, ` +
    `matched=${drivers.length}${itemSize ? ` (itemSize=${itemSize})` : ""}`
  );

  return drivers;
}
