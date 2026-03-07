import * as admin from "firebase-admin";

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

  // Query drivers in the geohash range
  const snapshot = await db
    .collection("users")
    .where("role", "==", "driver")
    .where("status", "==", "active")
    .where("kycStatus", "==", "approved")
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
