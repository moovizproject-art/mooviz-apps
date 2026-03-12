/**
 * useLocation — הוק מיקום GPS
 * Provides GPS location with permissions handling.
 * Uses react-native-geolocation-service for bare RN compatibility.
 * מספק מיקום GPS עם ניהול הרשאות
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { strings } from '../i18n/strings';

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
      title: strings.permissions.locationTitle.he,
      message: strings.permissions.locationMessage.he,
      buttonPositive: strings.permissions.allow.he,
      buttonNegative: strings.common.cancel.he,
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
      setError(strings.errors.locationPermission.he);
      return false;
    }
  }, []);

  const fetchLocation = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const granted = await requestPermission();
      if (!granted) {
        setError(strings.errors.locationNotGranted.he);
        setIsLoading(false);
        return;
      }

      try {
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
            setError(strings.errors.currentLocationFailed.he);
            setIsLoading(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 30000,
            maximumAge: 60000,
            forceRequestLocation: true,
            forceLocationManager: Platform.OS === 'android',
          },
        );
      } catch (nativeErr) {
        console.error('[useLocation] Native module error:', nativeErr);
        setError(strings.errors.locationServiceUnavailable.he);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[useLocation] Unexpected error:', err);
      setError(strings.errors.currentLocationFailed.he);
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
