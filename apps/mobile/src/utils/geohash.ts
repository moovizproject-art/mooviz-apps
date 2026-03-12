/**
 * Geohash Utilities — עזרי ג׳יאוהש
 * Wrapper around ngeohash for computing geohash strings from coordinates.
 * עטיפה סביב ngeohash לחישוב מחרוזות ג׳יאוהש מקואורדינטות
 */

// @ts-ignore — ngeohash has no type declarations
import ngeohash from 'ngeohash';

/** Default precision for driver proximity queries (1-5km radius) */
const DEFAULT_PRECISION = 7;

/**
 * Compute a geohash string from lat/lng coordinates.
 * חישוב מחרוזת ג׳יאוהש מקואורדינטות
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param precision - Geohash precision (default: 7, ~150m x 150m)
 */
export function computeGeohash(lat: number, lng: number, precision: number = DEFAULT_PRECISION): string {
  return ngeohash.encode(lat, lng, precision);
}

/**
 * Get neighboring geohash cells for proximity queries.
 * קבלת תאי ג׳יאוהש שכנים לשאילתות קרבה
 *
 * @param geohash - Center geohash string
 * @returns Array of 8 neighboring geohash strings + the center
 */
export function getGeohashNeighbors(geohash: string): string[] {
  const neighbors = ngeohash.neighbors(geohash);
  return [geohash, ...neighbors];
}

/**
 * Decode a geohash back to lat/lng coordinates.
 * פענוח ג׳יאוהש בחזרה לקואורדינטות
 */
export function decodeGeohash(geohash: string): { latitude: number; longitude: number } {
  const { latitude, longitude } = ngeohash.decode(geohash);
  return { latitude, longitude };
}
