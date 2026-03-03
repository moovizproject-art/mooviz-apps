/**
 * useLocation — הוק מיקום GPS
 * Provides GPS location with permissions handling.
 * Uses react-native-geolocation-service for bare RN compatibility.
 * מספק מיקום GPS עם ניהול הרשאות
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface UseLocationResult {
  location: GeoCoords | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: PermissionStatus;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

/** Request foreground location permission (platform-specific) */
async function requestLocationPermissionNative(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    return status === 'granted';
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
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<GeoCoords | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await requestLocationPermissionNative();
      setPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    } catch (err) {
      console.error('[useLocation] Permission request failed:', err);
      setError('שגיאה בבקשת הרשאת מיקום');
      return false;
    }
  }, []);

  const fetchLocation = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const granted = await requestPermission();
      if (!granted) {
        setError('הרשאת מיקום לא אושרה');
        setIsLoading(false);
        return;
      }

      Geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setIsLoading(false);
        },
        (positionError) => {
          console.error('[useLocation] Error:', positionError);
          setError('לא ניתן לקבל מיקום נוכחי');
          setIsLoading(false);
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    } catch (err) {
      console.error('[useLocation] Unexpected error:', err);
      setError('לא ניתן לקבל מיקום נוכחי');
      setIsLoading(false);
    }
  }, [requestPermission]);

  // Auto-fetch location on mount
  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return {
    location,
    isLoading,
    error,
    permissionStatus,
    requestPermission,
    refreshLocation: fetchLocation,
  };
}
