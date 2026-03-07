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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DriverTabScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { useLocation } from '../../hooks/useLocation';
import { DeliveryCard } from '../../components/DeliveryCard';
import { GlassCard } from '../../components/GlassCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants/design';
import { requestLocationPermission, requestNotificationPermission } from '../../utils/permissions';

const logo = require('../../assets/logo.png');

type Props = DriverTabScreenProps<'Feed'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = 180;

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const VEHICLE_TYPES = ['bicycle', 'bike', 'car', 'truck'] as const;
const VEHICLE_ICONS = { bicycle: '\u{1F6B2}', bike: '\u{1F3CD}', car: '\u{1F697}', truck: '\u{1F69A}' };
const SIZE_OPTIONS = ['small', 'medium', 'large'] as const;

const PREFS_KEY = '@driver_preferences';

interface DriverPreferences {
  nickname: string;
  radiusKm: number;
  isAvailable: boolean;
  deliverySizes: Record<string, boolean>;
  vehicleType: string;
  homeAddress: string;
  workAddress: string;
  schedule: Record<string, boolean>;
}

const DEFAULT_PREFS: DriverPreferences = {
  nickname: '',
  radiusKm: 10,
  isAvailable: true,
  deliverySizes: { small: true, medium: true, large: true },
  vehicleType: 'car',
  homeAddress: '',
  workAddress: '',
  schedule: {
    sunday: true, monday: true, tuesday: true, wednesday: true,
    thursday: true, friday: false, saturday: false,
  },
};

/**
 * FeedScreen (Driver) — redesigned with radar animation & preference controls
 */
export function FeedScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const drawer = useSettingsDrawer();

  const fullName = currentUser?.fullName || '';
  const firstName = fullName.split(' ')[0] || fullName;

  // Request permissions on first launch
  useEffect(() => {
    (async () => {
      await requestNotificationPermission();
      await requestLocationPermission();
    })();
  }, []);

  // ── Preferences state ──
  const [prefs, setPrefs] = useState<DriverPreferences>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((val) => {
      if (val) {
        try {
          const saved = JSON.parse(val);
          setPrefs({ ...DEFAULT_PREFS, ...saved });
        } catch {}
      }
      setPrefsLoaded(true);
    });
  }, []);

  const updatePref = useCallback(<K extends keyof DriverPreferences>(key: K, value: DriverPreferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Location & deliveries ──
  const { location, isLoading: locationLoading, error: locationError } = useLocation();
  // Memoize nearLocation to prevent infinite re-fetch loops
  const nearLocation = useMemo(
    () => location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
    [location?.latitude, location?.longitude],
  );
  const { deliveries, isLoading, refresh } = useDelivery({
    role: 'driver',
    statusFilter: ['pending'],
    nearLocation,
    radiusKm: prefs.radiusKm,
  });
  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('DriverDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

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

  const renderRadar = () => (
    <View style={styles.radarContainer}>
      <View style={[styles.radarOuter, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
        {/* Concentric circles */}
        {RING_SIZES.map((size, i) => (
          <View
            key={i}
            style={[
              styles.radarRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: prefs.isAvailable ? radarColor : colors.border,
                opacity: 0.3 + i * 0.1,
              },
            ]}
          />
        ))}
        {/* Sweep beam */}
        {prefs.isAvailable && (
          <Animated.View
            style={[
              styles.sweepBeam,
              {
                transform: [{ rotate: sweepRotate }],
              },
            ]}
          >
            <View style={[styles.sweepLine, { backgroundColor: radarColor }]} />
            <View style={[styles.sweepGlow, { backgroundColor: radarColor }]} />
          </Animated.View>
        )}
        {/* Center dot */}
        <View style={[styles.radarCenter, { backgroundColor: prefs.isAvailable ? radarColor : colors.border }]} />
      </View>
      <Text style={[styles.radarLabel, { color: prefs.isAvailable ? radarColor : colors.textSecondary }]}>
        {prefs.isAvailable ? t('driver.scanning') : t('driver.occupied')}
      </Text>
    </View>
  );

  // ── Toggle chip helper ──
  const Chip = ({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: string }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
      ]}
    >
      {icon && <Text style={styles.chipIcon}>{icon}</Text>}
      <Text style={[styles.chipText, { color: active ? colors.textInverse : colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );

  const renderHeader = (): React.JSX.Element => (
    <View>
      {/* ── Blue Header (same as Home) ── */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
        <View style={styles.headerTopRow}>
          <View style={[styles.logoCircle, { backgroundColor: '#FFFFFF' }]}>
            <Image source={logo} style={styles.logoImage} resizeMode="contain" />
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

      {/* Radar + availability */}
      {renderRadar()}

      {/* Available / Occupied toggle */}
      <GlassCard style={styles.section} padding="lg">
        <View style={styles.sectionRow}>
          <View style={styles.toggleLabelRow}>
            <View style={[styles.statusDot, { backgroundColor: prefs.isAvailable ? colors.success : colors.textTertiary }]} />
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              {prefs.isAvailable ? t('driver.available') : t('driver.occupied')}
            </Text>
          </View>
          <Switch
            value={prefs.isAvailable}
            onValueChange={(v) => updatePref('isAvailable', v)}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor={colors.surface}
          />
        </View>
      </GlassCard>

      {/* Nickname */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>{t('driver.nickname')}</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
          placeholder={t('driver.nicknamePlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          value={prefs.nickname}
          onChangeText={(v) => updatePref('nickname', v)}
          writingDirection="rtl"
        />
      </GlassCard>

      {/* Notification range */}
      <GlassCard style={styles.section} padding="lg">
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>{t('driver.notificationRange')}</Text>
          <Text style={[styles.sectionValue, { color: colors.primary }]}>{prefs.radiusKm} {t('driver.km')}</Text>
        </View>
        <View style={styles.rangeRow}>
          {[5, 10, 15, 25, 50].map((km) => (
            <Pressable
              key={km}
              onPress={() => updatePref('radiusKm', km)}
              style={[
                styles.rangeChip,
                {
                  backgroundColor: prefs.radiusKm === km ? colors.primary : colors.surface,
                  borderColor: prefs.radiusKm === km ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.rangeChipText, { color: prefs.radiusKm === km ? colors.textInverse : colors.textPrimary }]}>
                {km}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      {/* Delivery sizes */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>
          {t('driver.deliverySizes')}
        </Text>
        <View style={styles.chipRow}>
          {SIZE_OPTIONS.map((size) => (
            <Chip
              key={size}
              label={t(`driver.${size}`)}
              active={prefs.deliverySizes[size] ?? true}
              onPress={() =>
                updatePref('deliverySizes', {
                  ...prefs.deliverySizes,
                  [size]: !prefs.deliverySizes[size],
                })
              }
              icon={size === 'small' ? '\u{1F4E6}' : size === 'medium' ? '\u{1F4E6}' : '\u{1F4E6}'}
            />
          ))}
        </View>
      </GlassCard>

      {/* Vehicle type */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>
          {t('driver.vehicleType')}
        </Text>
        <View style={styles.chipRow}>
          {VEHICLE_TYPES.map((type) => (
            <Chip
              key={type}
              label={t(`driver.${type}`)}
              active={prefs.vehicleType === type}
              onPress={() => updatePref('vehicleType', type)}
              icon={VEHICLE_ICONS[type]}
            />
          ))}
        </View>
      </GlassCard>

      {/* Addresses */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>{t('driver.homeAddress')}</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
          placeholder={t('driver.addressPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          value={prefs.homeAddress}
          onChangeText={(v) => updatePref('homeAddress', v)}
          writingDirection="rtl"
        />
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>{t('driver.workAddress')}</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
          placeholder={t('driver.addressPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          value={prefs.workAddress}
          onChangeText={(v) => updatePref('workAddress', v)}
          writingDirection="rtl"
        />
        <Text style={[styles.addressHint, { color: colors.textTertiary }]}>{t('driver.addressHint')}</Text>
      </GlassCard>

      {/* Weekly availability schedule */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>
          {t('driver.availability')}
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
                  backgroundColor: prefs.schedule[day] ? colors.primary : colors.surface,
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
      </GlassCard>

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
          {t('driver.nearbyDeliveries')}
        </Text>
        {!isLoading && deliveries.length > 0 && (
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            {deliveries.length}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader()}

        {/* Delivery cards */}
        {(isLoading || locationLoading) && !locationError ? (
          <View style={styles.skeletonContainer}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : deliveries.length > 0 ? (
          deliveries.map((item) => (
            <View key={item.id} style={styles.cardWrapper}>
              <DeliveryCard
                delivery={item}
                onPress={() => handleDeliveryPress(item.id)}
                showDistance
              />
            </View>
          ))
        ) : (
          <EmptyState
            icon="search"
            message={locationError ? t('driver.locationWarning') : t('driver.noDeliveriesNearby')}
            submessage={locationError ? '' : t('driver.increaseRadius')}
          />
        )}
      </ScrollView>
      <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
    </SafeAreaView>
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
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  headerTopRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  settingsButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
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
    paddingVertical: SPACING.lg,
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
    marginTop: SPACING.md,
  },

  // ── Sections ──
  section: {
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
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
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  rangeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  rangeChipText: {
    ...TYPOGRAPHY.small,
    fontWeight: '700',
  },
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

  // ── Chips ──
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    ...TYPOGRAPHY.small,
    fontWeight: '600',
  },

  // ── Schedule ──
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dayChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    minWidth: 42,
    alignItems: 'center',
  },
  dayText: {
    ...TYPOGRAPHY.small,
    fontWeight: '600',
  },

  // ── Deliveries section ──
  deliveriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
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
  skeletonContainer: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
});
