/**
 * App Configuration Constants — קבועי תצורה
 * Application-wide configuration values.
 * ערכי תצורה כלל-אפליקטיביים
 */

import { NativeModules } from 'react-native';

// Read env vars from react-native-config native module
// The native module bakes .env values into the APK at build time via dotenv.gradle
const NativeConfig = NativeModules.RNCConfigModule;
let Config: Record<string, string | undefined> = {};
if (NativeConfig) {
  try {
    const result = NativeConfig.getConfig?.();
    // getConfig() returns { config: { KEY: value } } — unwrap the nested object
    Config = result?.config ?? result ?? {};
  } catch {
    Config = {};
  }
}
if (!Config.GOOGLE_MAPS_API_KEY) {
  console.warn('[config] react-native-config returned empty — native module:', !!NativeConfig, 'raw:', JSON.stringify(Config));
}

/** Maximum delivery search radius in kilometers */
// רדיוס חיפוש מקסימלי בקילומטרים
export const MAX_DELIVERY_RADIUS_KM = 50;

/** Default delivery search radius in kilometers */
// רדיוס חיפוש ברירת מחדל בקילומטרים
export const DEFAULT_DELIVERY_RADIUS_KM = 10;

/** Geohash precision for location indexing (5 = ~5km grid) */
// דיוק geohash לאינדוקס מיקום
export const GEOHASH_PRECISION = 6;

/** Maximum image file size in bytes (5MB) */
// גודל קובץ תמונה מקסימלי בבייטים
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024;

/** Maximum image dimensions for upload */
// ממדי תמונה מקסימליים להעלאה
export const IMAGE_MAX_WIDTH = 1920;
export const IMAGE_MAX_HEIGHT = 1920;

/** JPEG compression quality (0-1) */
// איכות דחיסת JPEG
export const IMAGE_QUALITY = 0.8;

/** OTP code length */
// אורך קוד OTP
export const OTP_LENGTH = 6;

/** Resend OTP cooldown in seconds */
// זמן המתנה לשליחת OTP חוזרת בשניות
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Maximum chat message length */
// אורך מקסימלי להודעת צ׳אט
export const CHAT_MESSAGE_MAX_LENGTH = 1000;

/** Number of messages to load per page */
// מספר הודעות לטעינה בכל עמוד
export const CHAT_MESSAGES_PAGE_SIZE = 50;

/** Number of deliveries to load per page */
// מספר משלוחים לטעינה בכל עמוד
export const DELIVERIES_PAGE_SIZE = 20;

/** Star rating scale */
// סולם דירוג כוכבים
export const RATING_SCALE = 5;

/** Location tracking interval — idle mode (ms) */
export const LOCATION_IDLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Location tracking interval — active delivery mode (ms) */
export const LOCATION_ACTIVE_INTERVAL_MS = 1 * 60 * 1000; // 1 minute

/** Minimum distance change to trigger update (meters) */
export const LOCATION_DISTANCE_FILTER_IDLE = 200; // 200m for idle
export const LOCATION_DISTANCE_FILTER_ACTIVE = 50; // 50m for active delivery

/** App version */
export const APP_VERSION = '1.1.4';

/** Deep link scheme */
export const DEEP_LINK_SCHEME = 'mooviz://';

/** Support email */
export const SUPPORT_EMAIL = 'support@mooviz.app';

/** Google Maps API key — loaded from .env via react-native-config */
// Also read in android/app/build.gradle for native Maps SDK manifest placeholder
export const GOOGLE_MAPS_API_KEY = Config.GOOGLE_MAPS_API_KEY ?? '';

/** Default map region — Israel center (Tel Aviv) */
// אזור מפה ברירת מחדל — מרכז ישראל (תל אביב)
export const DEFAULT_MAP_REGION = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
