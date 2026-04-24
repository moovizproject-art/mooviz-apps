import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Pressable,
  TextInput,
  Dimensions,
  Image,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

import { DriverTabScreenProps } from '../../navigation/types';
import { formatCurrency } from '../../utils/formatters';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery, Delivery } from '../../hooks/useDelivery';
import { useDriverLocationTracking } from '../../hooks/useDriverLocationTracking';
import { useDriverEarnings } from '../../hooks/useDriverEarnings';
import { DeliveryCard } from '../../components/DeliveryCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants/design';
import { requestLocationPermission, requestNotificationPermission, requestBackgroundLocationPermission } from '../../utils/permissions';
import { DriverOnboarding, shouldShowOnboarding } from '../../components/DriverOnboarding';
import { AddressAutocomplete, GeoAddress } from '../../components/AddressAutocomplete';
import LottieView from 'lottie-react-native';

const logo = require('../../assets/logo.png');
const radarAnimation = require('../../assets/animations/radar.lottie');

/** Haversine distance in km between two lat/lng points */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = DriverTabScreenProps<'Feed'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = 135; // 25% smaller (was 180)

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const VEHICLE_TYPES = ['bicycle', 'bike', 'car', 'truck'] as const;
const VEHICLE_ICONS = { bicycle: '\u{1F6B2}', bike: '\u{1F3CD}', car: '\u{1F697}', truck: '\u{1F69A}' };
const SIZE_OPTIONS = ['small', 'medium', 'large', 'xlarge'] as const;
const SIZE_ICONS: Record<string, string> = { small: '✉️', medium: '📦', large: '📦📦', xlarge: '🚚' };

const PREFS_KEY = '@driver_preferences';

const EARNINGS_TAB_KEYS = ['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear'] as const;

interface QuietHour {
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
}

interface DriverPreferences {
  nickname: string;
  radiusKm: number;
  isAvailable: boolean;
  deliverySizes: Record<string, boolean>;
  vehicleType: string;
  homeAddress: GeoAddress | null;
  workAddress: GeoAddress | null;
  schedule: Record<string, boolean>;
  quietHours: QuietHour[];
}

const DEFAULT_PREFS: DriverPreferences = {
  nickname: '',
  radiusKm: 10,
  isAvailable: true,
  deliverySizes: { small: true, medium: false, large: false, xlarge: false },
  vehicleType: 'car',
  homeAddress: null,
  workAddress: null,
  schedule: {
    sunday: true, monday: true, tuesday: true, wednesday: true,
    thursday: true, friday: false, saturday: false,
  },
  quietHours: [],
};

/**
 * FeedScreen (Driver) — redesigned with:
 * - Availability above radar
 * - 25% smaller radar
 * - Current delivery strip
 * - Earnings dashboard
 * - Square vehicle/size buttons
 * - Facebook-style slider for range
 * - Collapsible advanced settings
 */
export function FeedScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();

  const VEHICLE_LABELS: Record<string, string> = {
    bicycle: t('driver.bicycle'),
    bike: t('driver.bike'),
    car: t('driver.car'),
    truck: t('driver.truck'),
  };
  const SIZE_LABELS: Record<string, string> = {
    small: t('driver.small'),
    medium: t('driver.medium'),
    large: t('driver.large'),
    xlarge: t('form.sizeOther'),
  };
  const EARNINGS_TABS = EARNINGS_TAB_KEYS.map((key) => ({ key, label: t(`earnings.${key}`) }));
  const drawer = useSettingsDrawer();
  const insets = useSafeAreaInsets();

  const fullName = currentUser?.fullName || '';
  const firstName = fullName.split(' ')[0] || fullName;

  // Request permissions on first launch
  const [bgLocationDenied, setBgLocationDenied] = useState(false);
  useEffect(() => {
    (async () => {
      await requestNotificationPermission();
      await requestLocationPermission();
      // Check if driver has background ("always") location permission.
      // Without it, geohash goes stale when app is backgrounded → driver misses nearby deliveries.
      const hasBg = await requestBackgroundLocationPermission();
      if (!hasBg) setBgLocationDenied(true);
    })();
  }, []);


  // ── Preferences state ──
  const [prefs, setPrefs] = useState<DriverPreferences>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // isFirstDelivery removed — reserved for future onboarding UX
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [nicknameDirty, setNicknameDirty] = useState(false);
  const [earningsTab, setEarningsTab] = useState<string>('thisWeek');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [radarMinimized, setRadarMinimized] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nearMeOpen, setNearMeOpen] = useState(true);
  const [nearHomeOpen, setNearHomeOpen] = useState(true);
  const [nearWorkOpen, setNearWorkOpen] = useState(true);
  type SortMode = 'distance' | 'time' | 'price';
  const [sortMode, setSortMode] = useState<SortMode>('distance');

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(async (val) => {
      let saved: Partial<DriverPreferences> = {};
      if (val) {
        try {
          saved = JSON.parse(val);
          // Migrate old string addresses to null (user must re-enter with autocomplete)
          if (typeof saved.homeAddress === 'string') saved.homeAddress = null;
          if (typeof saved.workAddress === 'string') saved.workAddress = null;
        } catch {}
      }
      // Always sync addresses from Firestore — local cache may be stale
      if (currentUser?.uid) {
        try {
          const doc = await firestore().collection('users').doc(currentUser.uid).get();
          const dp = doc.data()?.driverPrefs;
          console.log('[FeedScreen] Firestore driverPrefs:', JSON.stringify({ home: dp?.homeAddress?.address, work: dp?.workAddress?.address, uid: currentUser.uid }));
          if (dp) {
            if (dp.homeAddress?.lat) saved.homeAddress = dp.homeAddress;
            if (dp.workAddress?.lat) saved.workAddress = dp.workAddress;
            if (dp.radiusKm) saved.radiusKm = dp.radiusKm;
            if (dp.deliverySizes && Array.isArray(dp.deliverySizes)) {
              const VALID_SIZES = new Set(['small', 'medium', 'large', 'xlarge']);
              const sizes: Record<string, boolean> = { small: false, medium: false, large: false, xlarge: false };
              dp.deliverySizes.forEach((s: string) => {
                // Normalize legacy keys ('envelope' → 'small') and skip unknown keys
                const normalized = s === 'envelope' ? 'small' : s;
                if (VALID_SIZES.has(normalized)) sizes[normalized] = true;
              });
              saved.deliverySizes = sizes;
            }
          }
        } catch (err) {
          console.warn('[FeedScreen] Firestore prefs sync error:', err);
        }
      }
      const merged = { ...DEFAULT_PREFS, ...saved };
      setPrefs(merged);
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(merged));
      setPrefsLoaded(true);
      // Ensure Firestore driverAvailable matches local isAvailable on every load.
      // Fixes: fresh installs where driverAvailable was never written to Firestore.
      if (currentUser?.uid) {
        firestore().collection('users').doc(currentUser.uid).update({
          driverAvailable: merged.isAvailable ?? true,
        }).catch(() => {});
      }
    });
    // Show onboarding on first visit
    shouldShowOnboarding().then((show) => {
      if (show) {
        setShowOnboarding(true);
        setAdvancedOpen(true); // Expand for first-timers
      }
    });
  }, [currentUser?.uid]);

  // ── Sync prefs to Firestore (debounced 2s, flush on blur) ──
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefsRef = useRef<DriverPreferences | null>(null);

  const doFirestoreSync = useCallback(async (nextPrefs: DriverPreferences) => {
    if (!currentUser?.uid) return;
    try {
      await firestore().collection('users').doc(currentUser.uid).update({
        // Sync the top-level driverAvailable flag so the Cloud Function
        // proximity query includes/excludes this driver correctly.
        driverAvailable: nextPrefs.isAvailable ?? true,
        driverPrefs: {
          homeAddress: nextPrefs.homeAddress,
          workAddress: nextPrefs.workAddress,
          radiusKm: nextPrefs.radiusKm,
          vehicleType: nextPrefs.vehicleType,
          deliverySizes: Object.entries(nextPrefs.deliverySizes)
            .filter(([_, v]) => v)
            .map(([k]) => k),
          schedule: nextPrefs.schedule,
          quietHoursStart: nextPrefs.quietHours[0]?.from || null,
          quietHoursEnd: nextPrefs.quietHours[0]?.to || null,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
      });
      pendingPrefsRef.current = null;
      // Brief "saved" flash
      setSavedFlash(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      console.warn('[FeedScreen] Prefs sync error:', err);
    }
  }, [currentUser?.uid]);

  const syncPrefsToFirestore = useCallback((nextPrefs: DriverPreferences) => {
    pendingPrefsRef.current = nextPrefs;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => doFirestoreSync(nextPrefs), 2000);
  }, [doFirestoreSync]);

  // Flush pending prefs to Firestore when screen loses focus (e.g. navigating to chat)
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      if (pendingPrefsRef.current && syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        doFirestoreSync(pendingPrefsRef.current);
      }
    });
    return unsub;
  }, [navigation, doFirestoreSync]);

  const updatePref = useCallback(<K extends keyof DriverPreferences>(key: K, value: DriverPreferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
      syncPrefsToFirestore(next);
      return next;
    });
  }, [syncPrefsToFirestore]);

  // ── Current active delivery (driver's own) — must come before location hook ──
  const { deliveries: activeDeliveries } = useDelivery({
    userId: currentUser?.uid,
    role: 'driver',
    statusFilter: ['pending', 'awaiting_confirm', 'waiting_for_pickup', 'picked_up'],
  });
  const currentDelivery = activeDeliveries[0] || null;

  // ── Location tracking (two-tier: idle 5min / active 1min) ──
  // Syncs to Firestore automatically — no manual sync needed
  const {
    location,
    error: locationError,
  } = useDriverLocationTracking({
    userId: currentUser?.uid,
    isDriver: true,
    activeDeliveryStatus: currentDelivery?.status,
  });
  const locationLoading = !location && !locationError;
  const nearLocation = useMemo(
    () => location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
    [location?.latitude, location?.longitude],
  );

  // ── Multi-location feed: current location + home + work ──
  // Query with current GPS location
  const { deliveries: rawNearMe, isLoading: loadingNearMe, refresh: _refresh } = useDelivery({
    role: 'driver',
    statusFilter: ['new', 'pending'],
    ...(nearLocation && prefsLoaded ? { nearLocation, radiusKm: prefs.radiusKm } : {}),
  });
  // Query near home address
  const homeLocation = useMemo(
    () => prefs.homeAddress ? { latitude: prefs.homeAddress.lat, longitude: prefs.homeAddress.lng } : undefined,
    [prefs.homeAddress?.lat, prefs.homeAddress?.lng],
  );
  const { deliveries: rawNearHome, isLoading: loadingHome } = useDelivery({
    role: 'driver',
    statusFilter: ['new', 'pending'],
    ...(homeLocation && prefsLoaded ? { nearLocation: homeLocation, radiusKm: prefs.radiusKm } : {}),
  });
  // Query near work address
  const workLocation = useMemo(
    () => prefs.workAddress ? { latitude: prefs.workAddress.lat, longitude: prefs.workAddress.lng } : undefined,
    [prefs.workAddress?.lat, prefs.workAddress?.lng],
  );
  const { deliveries: rawNearWork, isLoading: loadingWork } = useDelivery({
    role: 'driver',
    statusFilter: ['new', 'pending'],
    ...(workLocation && prefsLoaded ? { nearLocation: workLocation, radiusKm: prefs.radiusKm } : {}),
  });

  const isLoading = loadingNearMe || (homeLocation ? loadingHome : false) || (workLocation ? loadingWork : false);

  /** Size rank for capacity-based matching (same logic as server-side geohashService) */
  const SIZE_RANK: Record<string, number> = { small: 1, medium: 2, large: 3, xlarge: 4 };

  /** Max size rank the driver can carry based on their deliverySizes prefs */
  const maxDriverSizeRank = useMemo(() => {
    const enabled = Object.entries(prefs.deliverySizes)
      .filter(([k, v]) => v && SIZE_RANK[k] > 0)  // ignore unknown/legacy keys (rank 0)
      .map(([k]) => SIZE_RANK[k]);
    return enabled.length > 0 ? Math.max(...enabled) : 1; // default: small only
  }, [prefs.deliverySizes]);

  /** Filter & compute distance from a reference point, also filter by package size */
  const filterWithDistance = useCallback((
    raw: Delivery[],
    refLat: number,
    refLng: number,
    radiusKm: number,
  ): (Delivery & { _distKm: number })[] => {
    return raw
      .filter((d) => {
        if (d.senderId === currentUser?.uid) return false;
        // Size filter: skip deliveries too large for this driver
        const itemSize = d.itemSize || d.item?.size;
        if (itemSize) {
          const itemRank = SIZE_RANK[itemSize.toLowerCase()] ?? 0;
          if (itemRank > maxDriverSizeRank) return false;
        }
        return true;
      })
      .map((d) => {
        const pLat = d.pickup?.lat ?? d.pickup?.latitude;
        const pLng = d.pickup?.lng ?? d.pickup?.longitude;
        if (pLat == null || pLng == null) return null;
        const dist = haversineDistance(refLat, refLng, pLat, pLng);
        if (dist > radiusKm) return null;
        return { ...d, _distKm: dist };
      })
      .filter(Boolean) as (Delivery & { _distKm: number })[];
  }, [currentUser?.uid, maxDriverSizeRank]);

  /** Sort deliveries by current sortMode */
  const sortDeliveries = useCallback((items: (Delivery & { _distKm: number })[]) => {
    return [...items].sort((a, b) => {
      switch (sortMode) {
        case 'price':
          return (b.price ?? b.suggestedPrice ?? 0) - (a.price ?? a.suggestedPrice ?? 0);
        case 'time': {
          // ASAP first, then by scheduled date
          const isAsapA = !a.pickupDate || a.pickupDate === 'asap';
          const isAsapB = !b.pickupDate || b.pickupDate === 'asap';
          if (isAsapA && !isAsapB) return -1;
          if (!isAsapA && isAsapB) return 1;
          if (isAsapA && isAsapB) {
            // Both ASAP — sort by createdAt (older first)
            const tA = (a.createdAt as any)?._seconds ?? (a.createdAt as any)?.seconds ?? 0;
            const tB = (b.createdAt as any)?._seconds ?? (b.createdAt as any)?.seconds ?? 0;
            return tA - tB;
          }
          // Both scheduled — sort by pickupDate ascending
          const getPickupTime = (d: any) => {
            const pd = d.pickupDate;
            if (!pd || pd === 'asap') return 0;
            if (typeof pd === 'object' && pd._seconds) return pd._seconds;
            if (typeof pd === 'object' && pd.seconds) return pd.seconds;
            if (typeof pd === 'object' && pd.toDate) return pd.toDate().getTime() / 1000;
            if (typeof pd === 'string') return new Date(pd).getTime() / 1000;
            return 0;
          };
          return getPickupTime(a) - getPickupTime(b);
        }
        case 'distance':
        default:
          return a._distKm - b._distKm;
      }
    });
  }, [sortMode]);

  // Near Me deliveries — only when GPS location is available
  const nearMeDeliveries = useMemo(
    () => {
      if (!nearLocation) return []; // No GPS → show nothing in "Near Me", let home/work sections handle it
      const filtered = filterWithDistance(rawNearMe, nearLocation.latitude, nearLocation.longitude, prefs.radiusKm);
      return sortDeliveries(filtered);
    },
    [rawNearMe, nearLocation, prefs.radiusKm, filterWithDistance, sortDeliveries],
  );
  // Near Home deliveries (exclude already in nearMe)
  const nearMeIds = useMemo(() => new Set(nearMeDeliveries.map((d) => d.id)), [nearMeDeliveries]);
  const nearHomeDeliveries = useMemo(
    () => {
      if (!homeLocation) return [];
      const filtered = filterWithDistance(rawNearHome, homeLocation.latitude, homeLocation.longitude, prefs.radiusKm)
        .filter((d) => !nearMeIds.has(d.id));
      return sortDeliveries(filtered);
    },
    [rawNearHome, homeLocation, prefs.radiusKm, filterWithDistance, nearMeIds, sortDeliveries],
  );
  // Near Work deliveries (exclude already in nearMe + nearHome)
  const nearHomeIds = useMemo(() => new Set(nearHomeDeliveries.map((d) => d.id)), [nearHomeDeliveries]);
  const nearWorkDeliveries = useMemo(
    () => {
      if (!workLocation) return [];
      const filtered = filterWithDistance(rawNearWork, workLocation.latitude, workLocation.longitude, prefs.radiusKm)
        .filter((d) => !nearMeIds.has(d.id) && !nearHomeIds.has(d.id));
      return sortDeliveries(filtered);
    },
    [rawNearWork, workLocation, prefs.radiusKm, filterWithDistance, nearMeIds, nearHomeIds, sortDeliveries],
  );

  // Combined count for header
  const totalDeliveries = nearMeDeliveries.length + nearHomeDeliveries.length + nearWorkDeliveries.length;
  // Debug: log section counts
  useEffect(() => {
    console.log(`[FeedScreen] Sections — nearMe:${nearMeDeliveries.length} home:${nearHomeDeliveries.length} work:${nearWorkDeliveries.length} total:${totalDeliveries} homeAddr:${!!prefs.homeAddress} workAddr:${!!prefs.workAddress} rawHome:${rawNearHome.length} rawWork:${rawNearWork.length}`);
  }, [nearMeDeliveries.length, nearHomeDeliveries.length, nearWorkDeliveries.length, prefs.homeAddress, prefs.workAddress]);


  // ── Earnings ──
  const { earnings, recentTransactions, isLoading: _earningsLoading } = useDriverEarnings(currentUser?.uid);
  const [transactionsOpen, setTransactionsOpen] = useState(false);

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('DriverDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  // ── Nickname save to Firestore ──
  const handleSaveNickname = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      await firestore().collection('users').doc(currentUser.uid).update({
        nickname: prefs.nickname,
      });
      setNicknameDirty(false);
    } catch (err) {
      console.warn('[FeedScreen] Nickname save error:', err);
    }
  }, [currentUser?.uid, prefs.nickname]);

  // ── Advanced settings toggle ──
  const toggleAdvanced = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((prev) => !prev);
  }, []);

  // ── Radar sweep animation ──
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!prefs.isAvailable) {
      sweepAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [prefs.isAvailable, sweepAnim]);

  const sweepRotate = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radarColor = colors.primary;
  const RING_SIZES = [RADAR_SIZE, RADAR_SIZE * 0.7, RADAR_SIZE * 0.4, RADAR_SIZE * 0.15];

  // ── Current earnings period ──
  const currentEarnings = earnings[earningsTab as keyof typeof earnings] || earnings.thisWeek;

  const renderHeader = (): React.JSX.Element => (
    <View>
      {/* ── Blue Header ── */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + SPACING.sm }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
        <View style={styles.headerTopRow}>
          <View style={styles.logoCircle}>
            <Image source={logo} style={[styles.logoImage, { tintColor: '#FFFFFF' }]} resizeMode="contain" />
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={drawer.open}>
            <Text style={styles.settingsIcon}>{'\u2699'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.greeting, { color: colors.headerText }]}>
          {t('driver.greeting', { name: firstName })}
        </Text>
        <Text style={[styles.subtitle, { color: colors.headerTextSecondary }]}>
          {t('driver.subtitle')}
        </Text>
      </View>

      {/* ── Availability Toggle + Range (grouped) ── */}
      <View style={[styles.sectionCard, styles.section, { marginTop: SPACING.lg, backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: prefs.isAvailable ? colors.success : colors.textTertiary, borderStartWidth: 4, padding: SPACING.lg }]}>
        <View style={styles.sectionRow}>
          <View style={styles.toggleLabelRow}>
            <View style={[styles.statusDot, { backgroundColor: prefs.isAvailable ? colors.success : colors.textTertiary }]} />
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              {prefs.isAvailable ? t('driver.available') : t('driver.unavailable')}
            </Text>
          </View>
          <Switch
            value={prefs.isAvailable}
            onValueChange={(v) => updatePref('isAvailable', v)}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor={colors.surface}
          />
        </View>

        {/* Range slider — only visible when available */}
        {prefs.isAvailable && (
          <View style={{ marginTop: SPACING.sm }}>
            <View style={styles.sectionRow}>
              <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>📏 {t('commonExtra.notificationRange')}</Text>
              <Text style={[styles.sectionValue, { color: colors.primary }]}>{prefs.radiusKm} {t('driver.km')}</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderEdgeLabel, { color: colors.textTertiary }]}>5</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={50}
                step={1}
                value={prefs.radiusKm}
                onValueChange={(val) => updatePref('radiusKm', val)}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Text style={[styles.sliderEdgeLabel, { color: colors.textTertiary }]}>50</Text>
            </View>
          </View>
        )}

        {/* ── Radar — inside availability card ── */}
        {prefs.isAvailable && (
          <View style={styles.radarContainer}>
            {radarMinimized ? (
              <TouchableOpacity
                style={[styles.radarMinimizedRow, { borderColor: radarColor }]}
                onPress={() => setRadarMinimized(false)}
                activeOpacity={0.7}
              >
                <View style={[styles.radarCenterSmall, { backgroundColor: radarColor }]} />
                <Text style={[styles.radarLabel, { color: radarColor, marginTop: 0 }]}>
                  {t('driver.scanning')}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>▼</Text>
              </TouchableOpacity>
            ) : (
              <>
                <LottieView
                  source={radarAnimation}
                  autoPlay
                  loop
                  style={{ width: RADAR_SIZE, height: RADAR_SIZE }}
                />
                <TouchableOpacity
                  style={styles.radarMinimizeBtn}
                  onPress={() => setRadarMinimized(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.radarLabel, { color: radarColor }]}>
                    {t('driver.scanning')}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginStart: 6 }}>▲</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Current Active Delivery ── */}
      {currentDelivery && (
        <View style={[styles.section, { paddingHorizontal: SPACING.md }]}>
          <Text style={[styles.feedSectionTitle, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>
            📦 {t('deliveryExtra.activeDelivery')}
          </Text>
          <DeliveryCard
            delivery={currentDelivery}
            onPress={() => handleDeliveryPress(currentDelivery.id)}
          />
        </View>
      )}

      {/* ── Earnings Dashboard (collapsible) ── */}
      <View style={[styles.sectionCard, styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: colors.success, borderStartWidth: 4, padding: SPACING.lg }]}>
        <Pressable onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setEarningsOpen((prev) => !prev);
        }} style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            {`💰 ${t('driver.earnings')}`}
          </Text>
          <View style={styles.collapseEndRow}>
            <Text style={[styles.earningsQuickTotal, { color: colors.success }]}>
              {formatCurrency(currentEarnings.total)}
            </Text>
            <Text style={[styles.collapseArrow, { color: colors.textTertiary }]}>
              {earningsOpen ? '▼' : '◀'}
            </Text>
          </View>
        </Pressable>

        {earningsOpen && (
          <View style={{ marginTop: SPACING.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.earningsTabsScroll}>
              <View style={styles.earningsTabs}>
                {EARNINGS_TABS.map((tab) => (
                  <Pressable
                    key={tab.key}
                    onPress={() => setEarningsTab(tab.key)}
                    style={[
                      styles.earningsTab,
                      {
                        backgroundColor: earningsTab === tab.key ? colors.primary : colors.surface,
                        borderColor: earningsTab === tab.key ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.earningsTabText,
                      { color: earningsTab === tab.key ? colors.textInverse : colors.textPrimary },
                    ]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.earningsContent}>
              <View style={styles.earningsItem}>
                <Text style={[styles.earningsValue, { color: colors.success }]}>
                  {formatCurrency(currentEarnings.total)}
                </Text>
                <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>{t('commonExtra.total')}</Text>
              </View>
              <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.earningsItem}>
                <Text style={[styles.earningsValue, { color: colors.primary }]}>
                  {currentEarnings.count}
                </Text>
                <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>{t('home.deliveries')}</Text>
              </View>
              <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.earningsItem}>
                <Text style={[styles.earningsValue, { color: colors.textPrimary }]}>
                  {formatCurrency(currentEarnings.avgPerDelivery)}
                </Text>
                <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>{t('driver.average')}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ── Recent Transactions (collapsible) ── */}
      {recentTransactions.length > 0 && (
        <View style={[styles.sectionCard, styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: '#6366F1', borderStartWidth: 4, padding: SPACING.lg }]}>
          <Pressable onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setTransactionsOpen((prev) => !prev);
          }} style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              {`📋 ${t('driver.recentTransactions')}`}
            </Text>
            <View style={styles.collapseEndRow}>
              <Text style={[styles.earningsQuickTotal, { color: '#6366F1' }]}>
                {recentTransactions.length}
              </Text>
              <Text style={[styles.collapseArrow, { color: colors.textTertiary }]}>
                {transactionsOpen ? '▼' : '◀'}
              </Text>
            </View>
          </Pressable>

          {transactionsOpen && (
            <View style={{ marginTop: SPACING.sm }}>
              {recentTransactions.map((tx) => (
                <Pressable
                  key={tx.id}
                  onPress={() => navigation.navigate('DriverDeliveryDetail', { deliveryId: tx.id })}
                  style={[styles.transactionRow, { borderBottomColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.transactionRoute, { color: colors.textPrimary }]} numberOfLines={1}>
                      {tx.pickupCity} ← {tx.destinationCity}
                    </Text>
                    <Text style={[styles.transactionDate, { color: colors.textTertiary }]}>
                      {tx.completedAt.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={[styles.transactionPrice, { color: colors.success }]}>
                    {formatCurrency(tx.price)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Advanced Settings (collapsible) ── */}
      <View style={[styles.sectionCard, styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: colors.primary, borderStartWidth: 4, padding: SPACING.lg }]}>
        <Pressable onPress={toggleAdvanced} style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            {`⚙️ ${t('driver.advancedSettings')}`}
          </Text>
          <Text style={[styles.collapseArrow, { color: colors.textTertiary }]}>
            {advancedOpen ? '▼' : '◀'}
          </Text>
        </Pressable>

        {advancedOpen && (
          <View style={styles.advancedContent}>
            {/* ── Delivery Sizes Card ── */}
            <View style={[styles.innerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.innerCardTitle, { color: colors.textPrimary }]}>
                {`📦 ${t('deliveryExtra.deliverySizes')}`}
              </Text>
              <View style={styles.squareButtonRow}>
                {SIZE_OPTIONS.map((size) => {
                  const active = prefs.deliverySizes[size] ?? true;
                  return (
                    <Pressable
                      key={size}
                      onPress={() => {
                        const isChecking = !prefs.deliverySizes[size];
                        if (isChecking) {
                          // Auto-check all sizes up to this one
                          const sizeOrder = ['small', 'medium', 'large', 'xlarge'];
                          const idx = sizeOrder.indexOf(size);
                          const filled: Record<string, boolean> = { ...prefs.deliverySizes };
                          for (let i = 0; i <= idx; i++) filled[sizeOrder[i]] = true;
                          updatePref('deliverySizes', filled);
                        } else {
                          // Manual uncheck — only uncheck this one
                          updatePref('deliverySizes', {
                            ...prefs.deliverySizes,
                            [size]: false,
                          });
                        }
                      }}
                      style={[
                        styles.squareButton,
                        {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.squareButtonIcon, size === 'large' ? { fontSize: 16 } : undefined]}>{SIZE_ICONS[size]}</Text>
                      <Text style={[
                        styles.squareButtonLabel,
                        { color: active ? colors.textInverse : colors.textPrimary },
                      ]}>
                        {SIZE_LABELS[size] || t(`driver.${size}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Vehicle Type Card ── */}
            <View style={[styles.innerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.innerCardTitle, { color: colors.textPrimary }]}>
                {`🚛 ${t('driver.vehicleType')}`}
              </Text>
              <View style={styles.squareButtonRow}>
                {VEHICLE_TYPES.map((type) => {
                  const active = prefs.vehicleType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => updatePref('vehicleType', type)}
                      style={[
                        styles.squareButton,
                        {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.squareButtonIcon}>{VEHICLE_ICONS[type]}</Text>
                      <Text style={[
                        styles.squareButtonLabel,
                        { color: active ? colors.textInverse : colors.textPrimary },
                      ]}>
                        {VEHICLE_LABELS[type] || t(`driver.${type}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Schedule Card ── */}
            <View style={[styles.innerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.innerCardTitle, { color: colors.textPrimary }]}>
                📅 {t('driver.availability')}
              </Text>
              <View style={styles.scheduleGrid}>
                {DAYS.map((day) => (
                  <Pressable
                    key={day}
                    onPress={() =>
                      updatePref('schedule', {
                        ...prefs.schedule,
                        [day]: !prefs.schedule[day],
                      })
                    }
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: prefs.schedule[day] ? colors.primary : colors.background,
                        borderColor: prefs.schedule[day] ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: prefs.schedule[day] ? colors.textInverse : colors.textPrimary }]}>
                      {t(`driver.${day}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── Quiet Hours Card ── */}
            <View style={[styles.innerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.innerCardTitle, { color: colors.textPrimary }]}>
                {`🔇 ${t('driver.quietHours')}`}
              </Text>
              <Text style={[styles.innerCardHint, { color: colors.textTertiary }]}>
                {t('driver.quietHoursHint')}
              </Text>
              {(prefs.quietHours || []).map((qh, index) => (
                <View key={index} style={styles.quietHourRow}>
                  <TextInput
                    style={[styles.quietHourInput, { backgroundColor: colors.background, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    value={qh.from}
                    placeholder="08:00"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="numbers-and-punctuation"
                    onChangeText={(v) => {
                      const updated = [...(prefs.quietHours || [])];
                      updated[index] = { ...updated[index], from: v };
                      updatePref('quietHours', updated);
                    }}
                    textAlign="center"
                  />
                  <Text style={[styles.quietHourDash, { color: colors.textSecondary }]}>—</Text>
                  <TextInput
                    style={[styles.quietHourInput, { backgroundColor: colors.background, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    value={qh.to}
                    placeholder="22:00"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="numbers-and-punctuation"
                    onChangeText={(v) => {
                      const updated = [...(prefs.quietHours || [])];
                      updated[index] = { ...updated[index], to: v };
                      updatePref('quietHours', updated);
                    }}
                    textAlign="center"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const updated = (prefs.quietHours || []).filter((_, i) => i !== index);
                      updatePref('quietHours', updated);
                    }}
                    style={styles.quietHourRemove}
                  >
                    <Text style={{ color: '#E53935', fontSize: 18, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => {
                  const updated = [...(prefs.quietHours || []), { from: '22:00', to: '08:00' }];
                  updatePref('quietHours', updated);
                }}
                style={[styles.addQuietHourBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.addQuietHourText, { color: colors.primary }]}>{`+ ${t('driver.addQuietHours')}`}</Text>
              </TouchableOpacity>
            </View>

            {/* ── Addresses Card ── */}
            <View style={[styles.innerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.innerCardTitle, { color: colors.textPrimary }]}>
                {`📍 ${t('driver.favoriteAddresses')}`}
              </Text>
              <AddressAutocomplete
                label={t('driver.homeAddress')}
                value={prefs.homeAddress}
                onSelect={(addr) => updatePref('homeAddress', addr)}
                placeholder={t('driver.addressPlaceholder')}
              />
              <View style={{ height: SPACING.md }} />
              <AddressAutocomplete
                label={t('driver.workAddress')}
                value={prefs.workAddress}
                onSelect={(addr) => updatePref('workAddress', addr)}
                placeholder={t('driver.addressPlaceholder')}
              />
              <Text style={[styles.addressHint, { color: colors.textTertiary }]}>{t('driver.addressHint')}</Text>
              {savedFlash && prefs.homeAddress && (
                <Text style={styles.savedFlash}>{`✓ ${t('driver.saved')}`}</Text>
              )}
            </View>

            {/* ── Nickname Card ── */}
            <View style={[styles.innerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.innerCardTitle, { color: colors.textPrimary }]}>
                🏷️ {t('driver.nickname')}
              </Text>
              <View style={styles.nicknameRow}>
                <TextInput
                  style={[styles.textInput, styles.nicknameInput, { backgroundColor: colors.background, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  placeholder={t('driver.nicknamePlaceholder')}
                  placeholderTextColor={colors.inputPlaceholder}
                  value={prefs.nickname}
                  onChangeText={(v) => {
                    updatePref('nickname', v);
                    setNicknameDirty(true);
                  }}
                />
                {nicknameDirty && (
                  <TouchableOpacity
                    style={[styles.nicknameSaveBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSaveNickname}
                  >
                    <Text style={styles.nicknameSaveBtnText}>{t('driver.save')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {savedFlash && prefs.nickname.length > 0 && (
                <Text style={styles.savedFlash}>{`✓ ${t('driver.saved')}`}</Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Location warning */}
      {!location && !locationLoading && (
        <View style={[styles.locationWarning, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.locationWarningText, { color: colors.warning }]}>
            {t('driver.locationWarning')}
          </Text>
        </View>
      )}

      {/* Nearby deliveries header */}
      <View style={styles.deliveriesHeader}>
        <Text style={[styles.deliveriesTitle, { color: colors.textPrimary }]}>
          📍 {t('driver.nearbyDeliveries')}
        </Text>
        {!isLoading && totalDeliveries > 0 && (
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            ({totalDeliveries})
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader()}

        {/* Location error banner (non-blocking) */}
        {locationError && totalDeliveries === 0 && (
          <View style={[styles.locationBanner, { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' }]}>
            <Text style={{ fontSize: 14, color: '#E65100' }}>📍 {t('driver.locationWarning')}</Text>
          </View>
        )}

        {/* Background location permission banner — shown when driver only has "while using" */}
        {bgLocationDenied && (
          <TouchableOpacity
            style={[styles.locationBanner, { backgroundColor: '#E3F2FD', borderColor: '#90CAF9' }]}
            onPress={async () => {
              const granted = await requestBackgroundLocationPermission();
              if (granted) setBgLocationDenied(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, color: '#1565C0' }}>
              📍 לקבלת התראות על משלוחים קרובים גם ברקע — אפשר מיקום &apos;תמיד&apos; בהגדרות
            </Text>
          </TouchableOpacity>
        )}

        {(isLoading || locationLoading) && totalDeliveries === 0 ? (
          <View style={styles.skeletonContainer}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : totalDeliveries > 0 ? (
          <>
            {/* ── Near Me Section ── */}
            {nearMeDeliveries.length > 0 && (
              <View style={styles.feedSection}>
                <View style={[styles.feedSectionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Pressable
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setNearMeOpen((v) => !v); }}
                    style={styles.feedSectionTitleRow}
                  >
                    <Text style={[styles.feedSectionIcon]}>📍</Text>
                    <Text style={[styles.feedSectionTitle, { color: colors.textPrimary }]}>{t('driver.myLocation')}</Text>
                    <View style={[styles.feedSectionBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.feedSectionBadgeText, { color: colors.primary }]}>{nearMeDeliveries.length}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.sortIcons}>
                    {([
                      { mode: 'distance' as SortMode, label: '📏' },
                      { mode: 'time' as SortMode, label: '🕐' },
                      { mode: 'price' as SortMode, label: '💰' },
                    ]).map(({ mode, label }) => (
                      <Pressable key={mode} onPress={() => setSortMode(mode)} style={[styles.sortIcon, { borderWidth: 1.5, borderColor: sortMode === mode ? colors.primary : 'transparent', backgroundColor: sortMode === mode ? colors.primary + '15' : 'transparent' }]}>
                        <Text style={{ fontSize: 14 }}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setNearMeOpen((v) => !v); }}>
                    <Text style={[styles.collapseArrow, { color: colors.textTertiary }]}>
                      {nearMeOpen ? '▼' : '◀'}
                    </Text>
                  </Pressable>
                </View>
                {nearMeOpen && nearMeDeliveries.map((item) => (
                  <View key={item.id} style={styles.cardWrapper}>
                    <DeliveryCard
                      delivery={item}
                      onPress={() => handleDeliveryPress(item.id)}
                      showDistance
                      distanceLabel={`${item._distKm.toFixed(1)} ${t('driver.km')}`}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* ── Near Home Section ── */}
            {nearHomeDeliveries.length > 0 && (
              <View style={styles.feedSection}>
                <View style={[styles.feedSectionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Pressable
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setNearHomeOpen((v) => !v); }}
                    style={styles.feedSectionTitleRow}
                  >
                    <Text style={[styles.feedSectionIcon]}>🏠</Text>
                    <Text style={[styles.feedSectionTitle, { color: colors.textPrimary }]}>{t('driver.nearHome')}</Text>
                    <View style={[styles.feedSectionBadge, { backgroundColor: '#4CAF50' + '20' }]}>
                      <Text style={[styles.feedSectionBadgeText, { color: '#4CAF50' }]}>{nearHomeDeliveries.length}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.sortIcons}>
                    {([
                      { mode: 'distance' as SortMode, label: '📏' },
                      { mode: 'time' as SortMode, label: '🕐' },
                      { mode: 'price' as SortMode, label: '💰' },
                    ]).map(({ mode, label }) => (
                      <Pressable key={mode} onPress={() => setSortMode(mode)} style={[styles.sortIcon, { borderWidth: 1.5, borderColor: sortMode === mode ? colors.primary : 'transparent', backgroundColor: sortMode === mode ? colors.primary + '15' : 'transparent' }]}>
                        <Text style={{ fontSize: 14 }}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setNearHomeOpen((v) => !v); }}>
                    <Text style={[styles.collapseArrow, { color: colors.textTertiary }]}>
                      {nearHomeOpen ? '▼' : '◀'}
                    </Text>
                  </Pressable>
                </View>
                {nearHomeOpen && nearHomeDeliveries.map((item) => (
                  <View key={item.id} style={styles.cardWrapper}>
                    <DeliveryCard
                      delivery={item}
                      onPress={() => handleDeliveryPress(item.id)}
                      showDistance
                      distanceLabel={`${item._distKm.toFixed(1)} ${t('driver.kmFromHome')}`}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* ── Near Work Section ── */}
            {nearWorkDeliveries.length > 0 && (
              <View style={styles.feedSection}>
                <View style={[styles.feedSectionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Pressable
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setNearWorkOpen((v) => !v); }}
                    style={styles.feedSectionTitleRow}
                  >
                    <Text style={[styles.feedSectionIcon]}>💼</Text>
                    <Text style={[styles.feedSectionTitle, { color: colors.textPrimary }]}>{t('driver.nearWork')}</Text>
                    <View style={[styles.feedSectionBadge, { backgroundColor: '#FF9800' + '20' }]}>
                      <Text style={[styles.feedSectionBadgeText, { color: '#FF9800' }]}>{nearWorkDeliveries.length}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.sortIcons}>
                    {([
                      { mode: 'distance' as SortMode, label: '📏' },
                      { mode: 'time' as SortMode, label: '🕐' },
                      { mode: 'price' as SortMode, label: '💰' },
                    ]).map(({ mode, label }) => (
                      <Pressable key={mode} onPress={() => setSortMode(mode)} style={[styles.sortIcon, { borderWidth: 1.5, borderColor: sortMode === mode ? colors.primary : 'transparent', backgroundColor: sortMode === mode ? colors.primary + '15' : 'transparent' }]}>
                        <Text style={{ fontSize: 14 }}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setNearWorkOpen((v) => !v); }}>
                    <Text style={[styles.collapseArrow, { color: colors.textTertiary }]}>
                      {nearWorkOpen ? '▼' : '◀'}
                    </Text>
                  </Pressable>
                </View>
                {nearWorkOpen && nearWorkDeliveries.map((item) => (
                  <View key={item.id} style={styles.cardWrapper}>
                    <DeliveryCard
                      delivery={item}
                      onPress={() => handleDeliveryPress(item.id)}
                      showDistance
                      distanceLabel={`${item._distKm.toFixed(1)} ${t('driver.kmFromWork')}`}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <EmptyState
            icon="search"
            message={t('driver.noDeliveriesNearby')}
            submessage={t('driver.increaseRadius')}
          />
        )}
      </ScrollView>
      <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
      <DriverOnboarding visible={showOnboarding} onDone={() => setShowOnboarding(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Header (matches HomeScreen) ──
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  headerTopRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 160,
    height: 70,
  },
  settingsButton: {
    position: 'absolute',
    left: 0,
    top: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  greeting: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  // ── Radar ──
  radarContainer: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  radarOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  sweepBeam: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
  },
  sweepLine: {
    width: 2,
    height: RADAR_SIZE / 2,
    opacity: 0.8,
  },
  sweepGlow: {
    position: 'absolute',
    top: 0,
    width: RADAR_SIZE / 2,
    height: RADAR_SIZE / 2,
    borderBottomLeftRadius: RADAR_SIZE / 2,
    opacity: 0.08,
    transform: [{ translateX: RADAR_SIZE / 4 }],
  },
  radarCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radarLabel: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: SPACING.sm,
  },
  radarMinimizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    borderStyle: 'dashed',
  },
  radarCenterSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radarMinimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Sections ──
  section: {
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    ...TYPOGRAPHY.bodyBold,
  },
  sectionValue: {
    ...TYPOGRAPHY.bodyBold,
  },
  rangeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  earningsQuickTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  collapseEndRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  collapseArrow: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // ── Current Delivery Strip ──
  currentDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  currentDeliveryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(26,115,232,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDeliveryInfo: {
    flex: 1,
  },
  currentDeliveryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  currentDeliveryTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  currentDeliveryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginStart: 8,
  },
  currentDeliveryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  currentDeliveryDest: {
    fontSize: 13,
    marginBottom: 2,
  },
  currentDeliveryChat: {
    fontSize: 12,
    fontStyle: 'italic',
  },

  // ── Earnings Dashboard ──
  earningsTabsScroll: {
    marginBottom: SPACING.sm,
  },
  earningsTabs: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  earningsTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  earningsTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  earningsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.sm,
  },
  earningsItem: {
    alignItems: 'center',
    flex: 1,
  },
  earningsValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  earningsLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  earningsDivider: {
    width: 1,
    height: 32,
  },

  // ── Transactions ──
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transactionRoute: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },

  // ── Square Buttons (vehicle / sizes) ──
  squareButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  squareButton: {
    width: (SCREEN_WIDTH - SPACING.xxl * 2 - SPACING.lg * 2 - SPACING.md * 2 - SPACING.sm * 3) / 4,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  squareButtonIcon: {
    fontSize: 24,
  },
  squareButtonLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Slider ──
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderEdgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 24,
    textAlign: 'center',
  },

  // ── Advanced Settings ──
  advancedContent: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  innerCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  innerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  innerCardHint: {
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  advancedSubLabel: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nicknameInput: {
    flex: 1,
  },
  nicknameSaveBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    height: 42,
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  nicknameSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Quiet Hours ──
  quietHourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  quietHourInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: 15,
    fontWeight: '600',
    height: 42,
  },
  quietHourDash: {
    fontSize: 16,
    fontWeight: '600',
  },
  quietHourRemove: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addQuietHourBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  addQuietHourText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Text Input ──
  textInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.sm,
    height: 42,
  },
  addressHint: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
  },
  savedFlash: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
    marginTop: SPACING.xs,
    textAlign: 'left',
  },

  // ── Schedule ──
  scheduleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayChip: {
    flex: 1,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Deliveries section ──
  deliveriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  deliveriesTitle: {
    ...TYPOGRAPHY.h3,
  },
  resultsCount: {
    ...TYPOGRAPHY.bodyBold,
  },
  locationWarning: {
    marginHorizontal: SPACING.xxl,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  locationWarningText: {
    ...TYPOGRAPHY.caption,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  cardWrapper: {
    paddingHorizontal: SPACING.xxl,
  },
  sortIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginEnd: 8,
  },
  sortIcon: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  feedSection: {
    marginBottom: SPACING.sm,
  },
  feedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  feedSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  feedSectionIcon: {
    fontSize: 18,
  },
  feedSectionTitle: {
    ...TYPOGRAPHY.bodyBold,
  },
  feedSectionBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginStart: 4,
  },
  feedSectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  skeletonContainer: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  locationBanner: {
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
});
