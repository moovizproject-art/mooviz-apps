/**
 * Permissions — הרשאות
 * Location, camera, and notification permission helpers.
 * כלי עיזר להרשאות מיקום, מצלמה והתראות
 */

import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

// ──────────────────────────────────────────────
// Location permissions
// ──────────────────────────────────────────────

/**
 * Check if location permission is granted.
 * בדיקה אם הרשאת מיקום אושרה
 */
export async function hasLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Request location permission with explanation dialog.
 * בקשת הרשאת מיקום עם הסבר
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    showPermissionDeniedAlert(
      'הרשאת מיקום',
      'MOOVIZ צריך גישה למיקום שלך כדי למצוא משלוחים קרובים אליך.',
      // MOOVIZ needs location access to find deliveries near you.
    );
    return false;
  }

  return true;
}

/**
 * Request background location permission (for active delivery tracking).
 * בקשת הרשאת מיקום ברקע (למעקב משלוחים פעילים)
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  const foreground = await requestLocationPermission();
  if (!foreground) return false;

  const { status } = await Location.requestBackgroundPermissionsAsync();

  if (status !== 'granted') {
    showPermissionDeniedAlert(
      'הרשאת מיקום ברקע',
      'מעקב משלוחים בזמן אמת דורש הרשאת מיקום ברקע.',
      // Real-time delivery tracking requires background location permission.
    );
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────
// Camera permissions
// ──────────────────────────────────────────────

/**
 * Check if camera permission is granted.
 * בדיקה אם הרשאת מצלמה אושרה
 */
export async function hasCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.getCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request camera permission.
 * בקשת הרשאת מצלמה
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status: existing } = await ImagePicker.getCameraPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await ImagePicker.requestCameraPermissionsAsync();

  if (status !== 'granted') {
    showPermissionDeniedAlert(
      'הרשאת מצלמה',
      'MOOVIZ צריך גישה למצלמה לצילום הוכחות איסוף ומסירה.',
      // MOOVIZ needs camera access for pickup/delivery proof photos.
    );
    return false;
  }

  return true;
}

/**
 * Check if media library permission is granted.
 * בדיקה אם הרשאת גלריה אושרה
 */
export async function hasMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permission.
 * בקשת הרשאת גלריה
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status: existing } = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== 'granted') {
    showPermissionDeniedAlert(
      'הרשאת גלריה',
      'MOOVIZ צריך גישה לתמונות שלך לצורך צירוף תמונות פריט.',
      // MOOVIZ needs photo access to attach item images.
    );
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────
// Notification permissions
// ──────────────────────────────────────────────

/**
 * Check if notification permission is granted.
 * בדיקה אם הרשאת התראות אושרה
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted;
}

/**
 * Request notification permission.
 * בקשת הרשאת התראות
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;

  const { granted } = await Notifications.requestPermissionsAsync();

  if (!granted) {
    showPermissionDeniedAlert(
      'הרשאת התראות',
      'MOOVIZ צריך לשלוח לך התראות על עדכוני משלוחים והודעות.',
      // MOOVIZ needs to send you notifications about delivery updates and messages.
    );
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────

/**
 * Show alert when permission is denied, with option to open settings.
 * הצגת התראה כשהרשאה נדחתה, עם אפשרות לפתוח הגדרות
 */
function showPermissionDeniedAlert(title: string, message: string): void {
  Alert.alert(
    title,
    `${message}\n\nניתן לאשר בהגדרות המכשיר.`,
    // You can grant permission in device settings.
    [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'פתח הגדרות',
        // Open settings
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ],
  );
}
