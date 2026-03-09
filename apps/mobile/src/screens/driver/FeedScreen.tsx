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
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { useLocation } from '../../hooks/useLocation';
import { useDriverEarnings } from '../../hooks/useDriverEarnings';
import { DeliveryCard } from '../../components/DeliveryCard';
import { GlassCard } from '../../components/GlassCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants/design';
import { requestLocationPermission, requestNotificationPermission } from '../../utils/permissions';

const logo = require('../../assets/logo.png');

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
const VEHICLE_LABELS_HE: Record<string, string> = { bicycle: 'אופניים', bike: 'קטנוע', car: 'רכב', truck: 'משאית' };
const SIZE_OPTIONS = ['small', 'medium', 'large'] as const;
const SIZE_LABELS_HE: Record<string, string> = { small: 'קטן', medium: 'בינוני', large: 'גדול' };

const PREFS_KEY = '@driver_preferences';

const EARNINGS_TABS = [
  { key: 'thisWeek', label: 'השבוע' },
  { key: 'lastWeek', label: 'שבוע שעבר' },
  { key: 'thisMonth', label: 'החודש' },
  { key: 'lastMonth', label: 'חודש שעבר' },
  { key: 'thisYear', label: 'השנה' },
] as const;

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
  const drawer = useSettingsDrawer();
  const insets = useSafeAreaInsets();

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [nicknameDirty, setNicknameDirty] = useState(false);
  const [earningsTab, setEarningsTab] = useState<string>('thisWeek');

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

  // ── Current active delivery (driver's own) ──
  const { deliveries: activeDeliveries } = useDelivery({
    userId: currentUser?.uid,
    role: 'driver',
    statusFilter: ['pending', 'waiting', 'picked_up'],
  });
  const currentDelivery = activeDeliveries[0] || null;

  // ── Latest chat message for current delivery ──
  const [lastChatMessage, setLastChatMessage] = useState<string>('');
  useEffect(() => {
    if (!currentDelivery?.chatId) {
      setLastChatMessage('');
      return;
    }
    const unsub = firestore()
      .collection('chats')
      .doc(currentDelivery.chatId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .onSnapshot((snap) => {
        if (!snap.empty) {
          const msg = snap.docs[0].data();
          setLastChatMessage(msg.text || '');
        }
      });
    return () => unsub();
  }, [currentDelivery?.chatId]);

  // ── Earnings ──
  const { earnings, isLoading: earningsLoading } = useDriverEarnings(currentUser?.uid);

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

      {/* ── Availability Toggle (above radar) ── */}
      <GlassCard style={styles.section} padding="md">
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

      {/* ── Radar (25% smaller) ── */}
      <View style={styles.radarContainer}>
        <View style={[styles.radarOuter, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
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
          {prefs.isAvailable && (
            <Animated.View
              style={[
                styles.sweepBeam,
                { transform: [{ rotate: sweepRotate }] },
              ]}
            >
              <View style={[styles.sweepLine, { backgroundColor: radarColor }]} />
              <View style={[styles.sweepGlow, { backgroundColor: radarColor }]} />
            </Animated.View>
          )}
          <View style={[styles.radarCenter, { backgroundColor: prefs.isAvailable ? radarColor : colors.border }]} />
        </View>
        <Text style={[styles.radarLabel, { color: prefs.isAvailable ? radarColor : colors.textSecondary }]}>
          {prefs.isAvailable ? t('driver.scanning') : t('driver.occupied')}
        </Text>
      </View>

      {/* ── Current Delivery Strip ── */}
      {currentDelivery && (
        <TouchableOpacity
          onPress={() => handleDeliveryPress(currentDelivery.id)}
          activeOpacity={0.7}
        >
          <GlassCard style={styles.section} padding="md">
            <View style={styles.currentDeliveryRow}>
              <View style={styles.currentDeliveryIcon}>
                <Text style={{ fontSize: 22 }}>📦</Text>
              </View>
              <View style={styles.currentDeliveryInfo}>
                <View style={styles.currentDeliveryTop}>
                  <Text style={[styles.currentDeliveryTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {currentDelivery.itemDescription || 'משלוח פעיל'}
                  </Text>
                  <View style={[styles.currentDeliveryBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.currentDeliveryBadgeText, { color: colors.primary }]}>
                      {currentDelivery.status === 'picked_up' ? 'נאסף' : currentDelivery.status === 'waiting' ? 'ממתין' : 'ממתין לאישור'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.currentDeliveryDest, { color: colors.textSecondary }]} numberOfLines={1}>
                  → {currentDelivery.destination?.address || ''}
                </Text>
                {lastChatMessage ? (
                  <Text style={[styles.currentDeliveryChat, { color: colors.textTertiary }]} numberOfLines={1}>
                    💬 {lastChatMessage}
                  </Text>
                ) : null}
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>
      )}

      {/* ── Earnings Dashboard ── */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>
          💰 הכנסות
        </Text>
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
              ₪{currentEarnings.total.toLocaleString()}
            </Text>
            <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>סה״כ</Text>
          </View>
          <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
          <View style={styles.earningsItem}>
            <Text style={[styles.earningsValue, { color: colors.primary }]}>
              {currentEarnings.count}
            </Text>
            <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>משלוחים</Text>
          </View>
          <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
          <View style={styles.earningsItem}>
            <Text style={[styles.earningsValue, { color: colors.textPrimary }]}>
              ₪{currentEarnings.avgPerDelivery}
            </Text>
            <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>ממוצע</Text>
          </View>
        </View>
      </GlassCard>

      {/* ── Vehicle Type (square buttons) ── */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>
          🚛 סוג רכב
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
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={styles.squareButtonIcon}>{VEHICLE_ICONS[type]}</Text>
                <Text style={[
                  styles.squareButtonLabel,
                  { color: active ? colors.textInverse : colors.textPrimary },
                ]}>
                  {VEHICLE_LABELS_HE[type] || t(`driver.${type}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      {/* ── Notification Range (Facebook-style slider) ── */}
      <GlassCard style={styles.section} padding="lg">
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>📏 טווח התראות</Text>
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
      </GlassCard>

      {/* ── Delivery Sizes (square boxes) ── */}
      <GlassCard style={styles.section} padding="lg">
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>
          📦 גודל משלוחים
        </Text>
        <View style={styles.squareButtonRow}>
          {SIZE_OPTIONS.map((size) => {
            const active = prefs.deliverySizes[size] ?? true;
            return (
              <Pressable
                key={size}
                onPress={() =>
                  updatePref('deliverySizes', {
                    ...prefs.deliverySizes,
                    [size]: !prefs.deliverySizes[size],
                  })
                }
                style={[
                  styles.squareButton,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={styles.squareButtonIcon}>📦</Text>
                <Text style={[
                  styles.squareButtonLabel,
                  { color: active ? colors.textInverse : colors.textPrimary },
                ]}>
                  {SIZE_LABELS_HE[size] || t(`driver.${size}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      {/* ── Advanced Settings (collapsible) ── */}
      <GlassCard style={styles.section} padding="lg">
        <Pressable onPress={toggleAdvanced} style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            {advancedOpen ? '▼' : '▶'} הגדרות מתקדמות
          </Text>
        </Pressable>

        {advancedOpen && (
          <View style={styles.advancedContent}>
            {/* Weekly availability schedule */}
            <Text style={[styles.advancedSubLabel, { color: colors.textPrimary }]}>
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

            {/* Addresses */}
            <Text style={[styles.advancedSubLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>
              {t('driver.homeAddress')}
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder={t('driver.addressPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              value={prefs.homeAddress}
              onChangeText={(v) => updatePref('homeAddress', v)}
              writingDirection="rtl"
            />

            <Text style={[styles.advancedSubLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>
              {t('driver.workAddress')}
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder={t('driver.addressPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              value={prefs.workAddress}
              onChangeText={(v) => updatePref('workAddress', v)}
              writingDirection="rtl"
            />
            <Text style={[styles.addressHint, { color: colors.textTertiary }]}>{t('driver.addressHint')}</Text>

            {/* Nickname */}
            <Text style={[styles.advancedSubLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>
              {t('driver.nickname')}
            </Text>
            <View style={styles.nicknameRow}>
              <TextInput
                style={[styles.textInput, styles.nicknameInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder={t('driver.nicknamePlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={prefs.nickname}
                onChangeText={(v) => {
                  updatePref('nickname', v);
                  setNicknameDirty(true);
                }}
                writingDirection="rtl"
              />
              {nicknameDirty && (
                <TouchableOpacity
                  style={[styles.nicknameSaveBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveNickname}
                >
                  <Text style={styles.nicknameSaveBtnText}>שמור</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
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
          📍 {t('driver.nearbyDeliveries')}
        </Text>
        {!isLoading && deliveries.length > 0 && (
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            ({deliveries.length})
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
    left: 0,
    top: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
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
    paddingVertical: SPACING.md,
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

  // ── Square Buttons (vehicle / sizes) ──
  squareButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  squareButton: {
    width: (SCREEN_WIDTH - SPACING.xxl * 2 - SPACING.lg * 2 - SPACING.sm * 3) / 4,
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
    marginTop: SPACING.sm,
  },
  nicknameSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  skeletonContainer: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
});
