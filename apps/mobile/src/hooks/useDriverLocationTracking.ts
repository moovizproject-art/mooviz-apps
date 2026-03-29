/**
 * useDriverLocationTracking — מעקב מיקום נהג
 * Two-tier foreground location tracking for drivers:
 * - Idle mode: GPS every 5 minutes (coarse, battery-friendly)
 * - Active mode: GPS every 1 minute (high accuracy, during pickup/delivery)
 *
 * Syncs driver location to Firestore for real-time map visibility.
 * מעקב מיקום בשני מצבים: רגיל (5 דק׳) ופעיל (1 דק׳)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import firestore from '@react-native-firebase/firestore';
import { encodeGeohash } from '../services/geohash';
import { requestLocationPermission, requestBackgroundLocationPermission } from '../utils/permissions';
import {
  GEOHASH_PRECISION,
  LOCATION_IDLE_INTERVAL_MS,
  LOCATION_ACTIVE_INTERVAL_MS,
  LOCATION_DISTANCE_FILTER_ACTIVE,
} from '../constants/config';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type TrackingMode = 'off' | 'idle' | 'active';

/** Delivery statuses that indicate the driver is actively on a job */
const ACTIVE_DELIVERY_STATUSES = ['waiting_for_pickup', 'picked_up'];

/** Minimum interval between Firestore location writes in active mode (ms) */
const ACTIVE_SYNC_THROTTLE_MS = 30_000;

interface UseDriverLocationTrackingOptions {
  /** Current user's UID */
  userId: string | undefined;
  /** Whether the user is a driver */
  isDriver: boolean;
  /** The driver's current active delivery status, if any */
  activeDeliveryStatus?: string;
  /** Explicitly enable/disable tracking (default: true when isDriver) */
  enabled?: boolean;
}

interface UseDriverLocationTrackingResult {
  /** Latest known location */
  location: { latitude: number; longitude: number } | null;
  /** Whether tracking is active */
  isTracking: boolean;
  /** Current tracking tier */
  trackingMode: TrackingMode;
  /** Last sync timestamp */
  lastSyncAt: Date | null;
  /** Error message if tracking failed */
  error: string | null;
  /** Manually trigger a location refresh */
  forceRefresh: () => void;
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useDriverLocationTracking(
  options: UseDriverLocationTrackingOptions,
): UseDriverLocationTrackingResult {
  const { userId, isDriver, activeDeliveryStatus, enabled = true } = options;

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // Refs for cleanup
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  /** Timestamp of last Firestore sync — used to throttle active-mode writes */
  const lastSyncTimeRef = useRef<number>(0);

  // Determine tracking mode
  const trackingMode: TrackingMode = (() => {
    if (!isDriver || !enabled || !userId) return 'off';
    if (activeDeliveryStatus && ACTIVE_DELIVERY_STATUSES.includes(activeDeliveryStatus)) {
      return 'active';
    }
    return 'idle';
  })();

  // ── Firestore sync ──
  const syncToFirestore = useCallback(
    async (lat: number, lng: number) => {
      if (!userId) return;
      // Throttle: skip if last sync was less than 30s ago
      const now = Date.now();
      if (now - lastSyncTimeRef.current < ACTIVE_SYNC_THROTTLE_MS) return;
      lastSyncTimeRef.current = now;
      try {
        const geohash = encodeGeohash(lat, lng, GEOHASH_PRECISION);
        await firestore().collection('users').doc(userId).update({
          location: { lat, lng, geohash },
        });
        if (isMountedRef.current) {
          setLastSyncAt(new Date());
        }
      } catch (err) {
        console.warn('[LocationTracking] Firestore sync failed:', err);
      }
    },
    [userId],
  );

  // ── Handle a new position ──
  const onPosition = useCallback(
    (position: GeoPosition) => {
      if (!isMountedRef.current) return;
      const { latitude, longitude } = position.coords;
      setLocation({ latitude, longitude });
      setError(null);
      syncToFirestore(latitude, longitude);
    },
    [syncToFirestore],
  );

  const onPositionError = useCallback((err: { code: number; message: string }) => {
    if (!isMountedRef.current) return;
    console.warn('[LocationTracking] Position error:', err.code, err.message);
    // Don't overwrite location on transient errors — keep last known
    if (err.code === 1) {
      setError('permission-denied');
    } else if (err.code === 2) {
      setError('position-unavailable');
    } else if (err.code === 3) {
      setError('timeout');
    }
  }, []);

  // ── Single position fetch (for idle interval) ──
  const fetchOnce = useCallback(() => {
    Geolocation.getCurrentPosition(onPosition, onPositionError, {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: LOCATION_IDLE_INTERVAL_MS,
      forceRequestLocation: true,
      forceLocationManager: Platform.OS === 'android',
    });
  }, [onPosition, onPositionError]);

  // ── Manual refresh ──
  const forceRefresh = useCallback(() => {
    Geolocation.getCurrentPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      forceRequestLocation: true,
    });
  }, [onPosition, onPositionError]);

  // ── Stop all tracking ──
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isMountedRef.current) {
      setIsTracking(false);
    }
  }, []);

  // ── Start idle mode ──
  // iOS: use watchPosition with significant changes so background updates work.
  // Android: use interval + getCurrentPosition (background works with foreground service).
  const startIdleTracking = useCallback(async () => {
    stopTracking();

    if (Platform.OS === 'ios') {
      // iOS needs 'always' authorization for background location updates
      const granted = await requestBackgroundLocationPermission();
      if (!granted) {
        // Fall back to foreground-only
        const fgGranted = await requestLocationPermission();
        if (!fgGranted) { setError('permission-denied'); return; }
      }

      // Fetch immediately
      fetchOnce();

      // Use watchPosition with low accuracy + large distance filter for battery-friendly
      // background updates. This keeps the blue indicator but ensures geohash stays fresh.
      watchIdRef.current = Geolocation.watchPosition(onPosition, onPositionError, {
        enableHighAccuracy: false,
        distanceFilter: 500, // Update every 500m movement
        interval: LOCATION_IDLE_INTERVAL_MS,
        fastestInterval: 60000,
        showsBackgroundLocationIndicator: false,
        forceRequestLocation: true,
      });
    } else {
      const granted = await requestLocationPermission();
      if (!granted) { setError('permission-denied'); return; }

      // Fetch immediately
      fetchOnce();

      // Then every 5 minutes
      intervalRef.current = setInterval(fetchOnce, LOCATION_IDLE_INTERVAL_MS);
    }

    setIsTracking(true);
    setError(null);
    console.log(`[LocationTracking] Started IDLE mode (${Platform.OS === 'ios' ? 'watchPosition' : 'interval 5min'})`);
  }, [stopTracking, fetchOnce, onPosition, onPositionError]);

  // ── Start active mode (watchPosition, high accuracy) ──
  const startActiveTracking = useCallback(async () => {
    stopTracking();

    // Request background permission for active delivery (iOS "Always", Android background)
    const granted = await requestBackgroundLocationPermission();
    if (!granted) {
      // Fall back to foreground-only with higher frequency
      const fgGranted = await requestLocationPermission();
      if (!fgGranted) {
        setError('permission-denied');
        return;
      }
    }

    // Fetch immediately with high accuracy
    Geolocation.getCurrentPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      forceRequestLocation: true,
    });

    // watchPosition for continuous tracking
    watchIdRef.current = Geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      distanceFilter: LOCATION_DISTANCE_FILTER_ACTIVE,
      interval: LOCATION_ACTIVE_INTERVAL_MS,
      fastestInterval: LOCATION_ACTIVE_INTERVAL_MS / 2,
      forceRequestLocation: true,
      forceLocationManager: false, // Use fused location for better accuracy
      showsBackgroundLocationIndicator: true, // iOS blue bar
    });

    setIsTracking(true);
    setError(null);
    console.log('[LocationTracking] Started ACTIVE mode (every 1min, high accuracy)');
  }, [stopTracking, onPosition, onPositionError]);

  // ── React to mode changes ──
  useEffect(() => {
    if (trackingMode === 'active') {
      startActiveTracking();
    } else if (trackingMode === 'idle') {
      startIdleTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [trackingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause/resume on app state changes ──
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && trackingMode !== 'off') {
        // App came to foreground — refresh immediately
        fetchOnce();
      }
      // Note: watchPosition continues in background on iOS with "Always" permission
      // On Android, it stops when app is backgrounded (without a foreground service)
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [trackingMode, fetchOnce]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    location,
    isTracking,
    trackingMode,
    lastSyncAt,
    error,
    forceRefresh,
  };
}
