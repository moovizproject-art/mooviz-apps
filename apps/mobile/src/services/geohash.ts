/**
 * Geohash Service — שירות Geohash
 * Geohash encoding/decoding for proximity queries.
 * קידוד/פענוח geohash לשאילתות קרבה
 */

// Base32 character set for geohash encoding
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

// ──────────────────────────────────────────────
// Encode
// ──────────────────────────────────────────────

/**
 * Encode latitude/longitude into a geohash string.
 * קידוד קו רוחב/אורך למחרוזת geohash
 *
 * @param latitude - Latitude (-90 to 90)
 * @param longitude - Longitude (-180 to 180)
 * @param precision - Number of characters (default: 6)
 * @returns Geohash string
 */
export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision: number = 6,
): string {
  let latRange = { min: -90, max: 90 };
  let lonRange = { min: -180, max: 180 };
  let hash = '';
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

// ──────────────────────────────────────────────
// Decode
// ──────────────────────────────────────────────

interface DecodedGeohash {
  latitude: number;
  longitude: number;
  latitudeError: number;
  longitudeError: number;
}

/**
 * Decode a geohash string into latitude/longitude.
 * פענוח מחרוזת geohash לקו רוחב/אורך
 */
export function decodeGeohash(hash: string): DecodedGeohash {
  let latRange = { min: -90, max: 90 };
  let lonRange = { min: -180, max: 180 };
  let isEven = true;

  for (const char of hash) {
    const idx = BASE32.indexOf(char);
    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;
      if (isEven) {
        const mid = (lonRange.min + lonRange.max) / 2;
        if (bitValue === 1) {
          lonRange.min = mid;
        } else {
          lonRange.max = mid;
        }
      } else {
        const mid = (latRange.min + latRange.max) / 2;
        if (bitValue === 1) {
          latRange.min = mid;
        } else {
          latRange.max = mid;
        }
      }
      isEven = !isEven;
    }
  }

  return {
    latitude: (latRange.min + latRange.max) / 2,
    longitude: (lonRange.min + lonRange.max) / 2,
    latitudeError: (latRange.max - latRange.min) / 2,
    longitudeError: (lonRange.max - lonRange.min) / 2,
  };
}

// ──────────────────────────────────────────────
// Range queries
// ──────────────────────────────────────────────

/**
 * Get geohash range for a proximity query.
 * קבלת טווח geohash לשאילתת קרבה
 *
 * Returns lower and upper bounds for Firestore range query.
 *
 * @param latitude - Center latitude
 * @param longitude - Center longitude
 * @param radiusKm - Search radius in kilometers
 * @returns { lower, upper } geohash bounds
 */
export function getGeohashRange(
  latitude: number,
  longitude: number,
  radiusKm: number,
): { lower: string; upper: string } {
  // Approximate: 1 degree latitude ~ 111km
  const latDelta = radiusKm / 111.0;
  // Longitude degrees per km varies with latitude
  const lonDelta = radiusKm / (111.0 * Math.cos((latitude * Math.PI) / 180));

  const precision = getOptimalPrecision(radiusKm);

  const lower = encodeGeohash(latitude - latDelta, longitude - lonDelta, precision);
  const upper = encodeGeohash(latitude + latDelta, longitude + lonDelta, precision);

  return { lower, upper };
}

/**
 * Calculate distance between two coordinates in kilometers (Haversine formula).
 * חישוב מרחק בין שתי נקודות בקילומטרים (נוסחת Haversine)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get optimal geohash precision for a given radius.
 * Smaller radius = higher precision (more characters).
 */
function getOptimalPrecision(radiusKm: number): number {
  if (radiusKm <= 0.5) return 7;
  if (radiusKm <= 2) return 6;
  if (radiusKm <= 10) return 5;
  if (radiusKm <= 40) return 4;
  if (radiusKm <= 150) return 3;
  return 2;
}
