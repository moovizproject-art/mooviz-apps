/**
 * Permissions — הרשאות
 * Location, camera, media, and notification permission helpers.
 * Uses native PermissionsAndroid + library-specific APIs for bare RN.
 * כלי עיזר להרשאות מיקום, מצלמה והתראות
 */
import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import messaging from '@react-native-firebase/messaging';

// ──────────────────────────────────────────────
// Location permissions — הרשאות מיקום
// ──────────────────────────────────────────────

/** Check if location permission is granted */
export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    return status === 'granted';
  }
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
}

/** Request foreground location permission with explanation dialog */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    if (status !== 'granted') {
      showPermissionDeniedAlert(
        'הרשאת מיקום',
        'MOOVIZ צריך גישה למיקום שלך כדי למצוא משלוחים קרובים אליך.',
      );
      return false;
    }
    return true;
  }

  // Android
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'הרשאת מיקום',
      message: 'MOOVIZ צריך גישה למיקום שלך כדי למצוא משלוחים קרובים אליך.',
      buttonPositive: 'אשר',
      buttonNegative: 'ביטול',
    },
  );

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    showPermissionDeniedAlert(
      'הרשאת מיקום',
      'MOOVIZ צריך גישה למיקום שלך כדי למצוא משלוחים קרובים אליך.',
    );
    return false;
  }
  return true;
}

/** Request background location permission (for active delivery tracking) */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  const foreground = await requestLocationPermission();
  if (!foreground) return false;

  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('always');
    return status === 'granted';
  }

  // Android 10+ needs separate background permission
  if (Platform.Version >= 29) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'הרשאת מיקום ברקע',
        message: 'מעקב משלוחים בזמן אמת דורש הרשאת מיקום ברקע.',
        buttonPositive: 'אשר',
        buttonNegative: 'ביטול',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
}

// ──────────────────────────────────────────────
// Camera permissions — הרשאות מצלמה
// ──────────────────────────────────────────────

/** Check if camera permission is granted */
export async function hasCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true; // Handled by Info.plist prompt
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
}

/** Request camera permission */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true; // iOS prompts automatically via Info.plist

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'הרשאת מצלמה',
      message: 'MOOVIZ צריך גישה למצלמה לצילום הוכחות איסוף ומסירה.',
      buttonPositive: 'אשר',
      buttonNegative: 'ביטול',
    },
  );

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    showPermissionDeniedAlert(
      'הרשאת מצלמה',
      'MOOVIZ צריך גישה למצלמה לצילום הוכחות איסוף ומסירה.',
    );
    return false;
  }
  return true;
}

/** Check if media/photo library permission is granted */
export async function hasMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  if (Platform.Version >= 33) {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
  }
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
}

/** Request media/photo library permission */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;

  const permission = Platform.Version >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const granted = await PermissionsAndroid.request(permission, {
    title: 'הרשאת גלריה',
    message: 'MOOVIZ צריך גישה לתמונות שלך לצורך צירוף תמונות פריט.',
    buttonPositive: 'אשר',
    buttonNegative: 'ביטול',
  });

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    showPermissionDeniedAlert(
      'הרשאת גלריה',
      'MOOVIZ צריך גישה לתמונות שלך לצורך צירוף תמונות פריט.',
    );
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────
// Notification permissions — הרשאות התראות
// ──────────────────────────────────────────────

/** Check if notification permission is granted */
export async function hasNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().hasPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/** Request notification permission */
export async function requestNotificationPermission(): Promise<boolean> {
  const hasIt = await hasNotificationPermission();
  if (hasIt) return true;

  const authStatus = await messaging().requestPermission();
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!granted) {
    showPermissionDeniedAlert(
      'הרשאת התראות',
      'MOOVIZ צריך לשלוח לך התראות על עדכוני משלוחים והודעות.',
    );
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────

/** Show alert when permission is denied, with option to open settings */
function showPermissionDeniedAlert(title: string, message: string): void {
  Alert.alert(
    title,
    `${message}\n\nניתן לאשר בהגדרות המכשיר.`,
    [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'פתח הגדרות',
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
