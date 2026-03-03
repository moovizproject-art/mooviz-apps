import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

interface UseLocationResult {
  location: GeoCoords | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: Location.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

/**
 * useLocation — הוק מיקום GPS
 * Provides GPS location with permissions handling.
 * מספק מיקום GPS עם ניהול הרשאות
 */
export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<GeoCoords | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      return status === 'granted';
    } catch (err) {
      console.error('[useLocation] Permission request failed:', err);
      setError('שגיאה בבקשת הרשאת מיקום'); // Error requesting location permission
      return false;
    }
  }, []);

  const fetchLocation = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setError('הרשאת מיקום לא אושרה'); // Location permission not granted
          setIsLoading(false);
          return;
        }
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
      });
    } catch (err) {
      console.error('[useLocation] Error getting location:', err);
      setError('לא ניתן לקבל מיקום נוכחי'); // Cannot get current location
    } finally {
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
