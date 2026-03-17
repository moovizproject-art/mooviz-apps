/**
 * useDriverAvailability — הוק זמינות נהג
 * Manages driver online/offline state with location tracking.
 * ניהול מצב מקוון/לא מקוון של נהג עם מעקב מיקום
 *
 * When available:
 * - Starts watching position with high accuracy
 * - Updates Firestore location + geohash every 30 seconds
 * When unavailable:
 * - Stops location tracking
 * - Sets driverAvailable=false in Firestore
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { computeGeohash } from '../utils/geohash';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface DriverAvailability {
  /** Whether the driver is currently available for deliveries */
  isAvailable: boolean;
  /** Whether the availability state is being loaded/toggled */
  isLoading: boolean;
  /** Toggle availability on/off */
  toggleAvailability: () => Promise<void>;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Minimum distance change (meters) before location update fires */
const DISTANCE_FILTER_METERS = 100;

/** How often to write location to Firestore (ms) */
const LOCATION_UPDATE_INTERVAL_MS = 30_000;

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useDriverAvailability(userId: string | undefined): DriverAvailability {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Listen to Firestore for current availability state
  // האזנה ל-Firestore למצב זמינות נוכחי
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('users')
      .doc(userId)
      .onSnapshot(
        (snapshot) => {
          if (!isMountedRef.current) return;
          const data = snapshot.data();
          setIsAvailable(data?.driverAvailable ?? false);
          setIsLoading(false);
        },
        (error) => {
          console.error('[useDriverAvailability] Firestore listener error:', error);
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        },
      );

    return unsubscribe;
  }, [userId]);

  // Write location to Firestore (throttled)
  // כתיבת מיקום ל-Firestore (מוגבל קצב)
  const updateLocationInFirestore = useCallback(
    async (position: GeoPosition) => {
      if (!userId) return;

      const now = Date.now();
      if (now - lastUpdateRef.current < LOCATION_UPDATE_INTERVAL_MS) {
        return;
      }
      lastUpdateRef.current = now;

      const { latitude, longitude } = position.coords;
      const geohash = computeGeohash(latitude, longitude);

      try {
        await firestore().collection('users').doc(userId).update({
          location: { lat: latitude, lng: longitude, geohash },
          locationUpdatedAt: firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error('[useDriverAvailability] Location update error:', error);
      }
    },
    [userId],
  );

  // Start watching position
  // התחלת מעקב מיקום
  const startLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        updateLocationInFirestore(position);
      },
      (error) => {
        console.error('[useDriverAvailability] Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: DISTANCE_FILTER_METERS,
        interval: LOCATION_UPDATE_INTERVAL_MS,
        fastestInterval: LOCATION_UPDATE_INTERVAL_MS / 2,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  }, [updateLocationInFirestore]);

  // Stop watching position
  // הפסקת מעקב מיקום
  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Toggle availability on/off
  // החלפת זמינות
  const toggleAvailability = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const newAvailability = !isAvailable;

      if (newAvailability) {
        // Turning on — start location tracking, then update Firestore
        startLocationWatch();

        // Get initial position immediately
        Geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const geohash = computeGeohash(latitude, longitude);

            await firestore().collection('users').doc(userId).update({
              driverAvailable: true,
              location: { lat: latitude, lng: longitude, geohash },
              locationUpdatedAt: firestore.FieldValue.serverTimestamp(),
            });
          },
          async (error) => {
            console.error('[useDriverAvailability] getCurrentPosition error:', error);
            // Still set available even if we can't get location yet
            await firestore().collection('users').doc(userId).update({
              driverAvailable: true,
            });
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } else {
        // Turning off — stop location tracking, update Firestore
        stopLocationWatch();
        await firestore().collection('users').doc(userId).update({
          driverAvailable: false,
        });
      }
    } catch (error) {
      console.error('[useDriverAvailability] Toggle error:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, isAvailable, startLocationWatch, stopLocationWatch]);

  // Cleanup on unmount — stop location watch but keep driverAvailable persisted.
  // driverAvailable is a persistent preference, NOT a session flag.
  // Drivers should still receive notifications even when the app is closed.
  // ניקוי בעת הסרה — הפסקת מעקב מיקום בלבד, זמינות נשמרת
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [userId]);

  return {
    isAvailable,
    isLoading,
    toggleAvailability,
  };
}
