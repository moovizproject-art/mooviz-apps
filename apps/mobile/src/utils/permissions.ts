/**
 * Permissions — הרשאות
 * Location, camera, media, and notification permission helpers.
 * Uses native PermissionsAndroid + library-specific APIs for bare RN.
 * כלי עיזר להרשאות מיקום, מצלמה והתראות
 */
import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import messaging from '@react-native-firebase/messaging';
import { strings } from '../i18n/strings';

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
        strings.permissions.locationTitle.he,
        strings.permissions.locationMessage.he,
      );
      return false;
    }
    return true;
  }

  // Android
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: strings.permissions.locationTitle.he,
      message: strings.permissions.locationMessage.he,
      buttonPositive: strings.permissions.allow.he,
      buttonNegative: strings.common.cancel.he,
    },
  );

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    showPermissionDeniedAlert(
      strings.permissions.locationTitle.he,
      strings.permissions.locationMessage.he,
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
  if (Number(Platform.Version) >= 29) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: strings.permissions.backgroundLocationTitle.he,
        message: strings.permissions.backgroundLocationMessage.he,
        buttonPositive: strings.permissions.allow.he,
        buttonNegative: strings.common.cancel.he,
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
      title: strings.permissions.cameraTitle.he,
      message: strings.permissions.cameraMessage.he,
      buttonPositive: strings.permissions.allow.he,
      buttonNegative: strings.common.cancel.he,
    },
  );

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    showPermissionDeniedAlert(
      strings.permissions.cameraTitle.he,
      strings.permissions.cameraMessage.he,
    );
    return false;
  }
  return true;
}

/** Check if media/photo library permission is granted */
export async function hasMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  if (Number(Platform.Version) >= 33) {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
  }
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
}

/** Request media/photo library permission */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;

  const permission = Number(Platform.Version) >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const granted = await PermissionsAndroid.request(permission, {
    title: strings.permissions.galleryTitle.he,
    message: strings.permissions.galleryMessage.he,
    buttonPositive: strings.permissions.allow.he,
    buttonNegative: strings.common.cancel.he,
  });

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    showPermissionDeniedAlert(
      strings.permissions.galleryTitle.he,
      strings.permissions.galleryMessage.he,
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

/** Request notification permission — handles Android 13+ POST_NOTIFICATIONS */
export async function requestNotificationPermission(): Promise<boolean> {
  const hasIt = await hasNotificationPermission();
  if (hasIt) return true;

  // Android 13+ (API 33) requires explicit runtime permission
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      showPermissionDeniedAlert(
        strings.permissions.notificationTitle.he,
        strings.permissions.notificationMessage.he,
      );
      return false;
    }
  }

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
    `${message}\n\n${strings.permissions.deniedSettingsHint.he}`,
    [
      { text: strings.common.cancel.he, style: 'cancel' },
      {
        text: strings.permissions.openSettings.he,
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
