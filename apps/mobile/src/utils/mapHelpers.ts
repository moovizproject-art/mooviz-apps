/**
 * Map Helpers — עזרי מפה
 * Utility functions for Google Maps operations:
 * region calculation, distance, zoom, and coordinate formatting.
 * פונקציות עזר למפות: חישוב אזור, מרחק, זום ועיצוב קואורדינטות
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends Coordinate {
  latitudeDelta: number;
  longitudeDelta: number;
}

// ──────────────────────────────────────────────
// Distance calculation
// ──────────────────────────────────────────────

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 * חישוב מרחק בין שתי נקודות בקילומטרים (נוסחת הוורסין)
 */
export function getDistanceKm(from: Coordinate, to: Coordinate): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ──────────────────────────────────────────────
// Region calculation
// ──────────────────────────────────────────────

/**
 * Calculate a map region that fits all given coordinates with padding.
 * חישוב אזור מפה שמכיל את כל הנקודות עם מרווח
 */
export function getRegionForCoordinates(
  coordinates: Coordinate[],
  paddingFactor: number = 1.3,
): MapRegion {
  if (coordinates.length === 0) {
    // Default to Israel center (Tel Aviv)
    return { latitude: 32.0853, longitude: 34.7818, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }

  if (coordinates.length === 1) {
    return {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;

  for (const coord of coordinates) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  }

  const latDelta = (maxLat - minLat) * paddingFactor;
  const lngDelta = (maxLng - minLng) * paddingFactor;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(latDelta, 0.01),
    longitudeDelta: Math.max(lngDelta, 0.01),
  };
}

/**
 * Create a region centered on a coordinate with a given radius in km.
 * יצירת אזור מפה ממוקד עם רדיוס בקילומטרים
 */
export function getRegionForRadius(center: Coordinate, radiusKm: number): MapRegion {
  // 1 degree latitude ≈ 111 km
  const latDelta = (radiusKm / 111) * 2;
  // Longitude degrees vary by latitude
  const lngDelta = (radiusKm / (111 * Math.cos(toRad(center.latitude)))) * 2;

  return {
    ...center,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

// ──────────────────────────────────────────────
// Formatting
// ──────────────────────────────────────────────

/**
 * Format distance for display.
 * עיצוב מרחק לתצוגה
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} מ'`; // meters
  }
  return `${km.toFixed(1)} ק"מ`; // km
}

/**
 * Check if a coordinate is within Israel's bounding box.
 * בדיקה אם קואורדינטה נמצאת בגבולות ישראל
 */
export function isInIsrael(coord: Coordinate): boolean {
  return (
    coord.latitude >= 29.5 &&
    coord.latitude <= 33.5 &&
    coord.longitude >= 34.0 &&
    coord.longitude <= 36.0
  );
}

/** Default Israel-centered region */
export const ISRAEL_REGION: MapRegion = {
  latitude: 31.5,
  longitude: 34.8,
  latitudeDelta: 4.0,
  longitudeDelta: 3.0,
};

/** Default Tel Aviv region for development */
export const TEL_AVIV_REGION: MapRegion = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
