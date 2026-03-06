import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Switch,
  Pressable,
  TextInput,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DriverTabScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useDelivery } from '../../hooks/useDelivery';
import { useLocation } from '../../hooks/useLocation';
import { DeliveryCard } from '../../components/DeliveryCard';
import { GlassCard } from '../../components/GlassCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { MAX_DELIVERY_RADIUS_KM } from '../../constants/config';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants/design';
import { requestLocationPermission, requestNotificationPermission } from '../../utils/permissions';

type Props = DriverTabScreenProps<'Feed'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = 180;
const RING_COUNT = 3;

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
  const drawer = useSettingsDrawer();

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
  const { location, isLoading: locationLoading } = useLocation();
  const { deliveries, isLoading, refresh } = useDelivery({
    role: 'driver',
    statusFilter: ['pending'],
    nearLocation: location
      ? { latitude: location.latitude, longitude: location.longitude }
      : undefined,
    radiusKm: prefs.radiusKm,
  });

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('DriverDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  // ── Radar animation ──
  const ringAnims = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!prefs.isAvailable) {
      ringAnims.forEach((a) => a.setValue(0));
      return;
    }
    const animations = ringAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [prefs.isAvailable, ringAnims]);

  const renderRadar = () => (
    <View style={styles.radarContainer}>
      <View style={[styles.radarOuter, { borderColor: prefs.isAvailable ? colors.primary : colors.border }]}>
        {prefs.isAvailable && ringAnims.map((anim, i) => {
          const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] });
          const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] });
          return (
            <Animated.View
              key={i}
              style={[
                styles.radarRing,
                {
                  borderColor: colors.primary,
                  transform: [{ scale }],
                  opacity,
                },
              ]}
            />
          );
        })}
        <View style={[styles.radarCenter, { backgroundColor: prefs.isAvailable ? colors.primary : colors.border }]}>
          <Text style={styles.radarIcon}>{prefs.isAvailable ? '\u{1F4E1}' : '\u{23F8}'}</Text>
        </View>
      </View>
      <Text style={[styles.radarLabel, { color: prefs.isAvailable ? colors.primary : colors.textSecondary }]}>
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
      <TabHeader title={t('driver.availableDeliveries')} onSettingsPress={drawer.open} />

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

      {/* Notification range slider */}
      <GlassCard style={styles.section} padding="lg">
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>{t('driver.notificationRange')}</Text>
          <Text style={[styles.sectionValue, { color: colors.primary }]}>{prefs.radiusKm} {t('driver.km')}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={MAX_DELIVERY_RADIUS_KM}
          step={1}
          value={prefs.radiusKm}
          onValueChange={(v) => updatePref('radiusKm', v)}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
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
      <FlatList
        data={isLoading ? [] : deliveries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DeliveryCard
            delivery={item}
            onPress={() => handleDeliveryPress(item.id)}
            showDistance
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading || locationLoading ? (
            <View style={styles.skeletonContainer}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon="search"
              message={t('driver.noDeliveriesNearby')}
              submessage={t('driver.increaseRadius')}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          !isLoading && deliveries.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
      />
      <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Radar ──
  radarContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  radarOuter: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: RADAR_SIZE - 20,
    height: RADAR_SIZE - 20,
    borderRadius: (RADAR_SIZE - 20) / 2,
    borderWidth: 2,
  },
  radarCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  radarIcon: {
    fontSize: 28,
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
  slider: {
    width: '100%',
    height: 40,
    marginTop: SPACING.xs,
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
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  skeletonContainer: {
    gap: SPACING.md,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
});
