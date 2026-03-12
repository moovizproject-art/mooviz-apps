import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Image,
  StatusBar,
  TouchableOpacity,
  Pressable,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClientTabScreenProps } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { formatCurrency } from '../../utils/formatters';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { AnimatedButton } from '../../components/AnimatedButton';
import { DeliveryCard } from '../../components/DeliveryCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/tokens';
import { requestLocationPermission, requestNotificationPermission } from '../../utils/permissions';
import { useSenderExpenses } from '../../hooks/useSenderExpenses';
import { SenderOnboarding, shouldShowSenderOnboarding } from '../../components/SenderOnboarding';
import { strings } from '../../i18n/strings';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPENSES_TABS = [
  { key: 'thisWeek', label: strings.earnings.thisWeek.he },
  { key: 'lastWeek', label: strings.earnings.lastWeek.he },
  { key: 'thisMonth', label: strings.earnings.thisMonth.he },
  { key: 'lastMonth', label: strings.earnings.lastMonth.he },
  { key: 'thisYear', label: strings.earnings.thisYear.he },
] as const;

const logo = require('../../assets/logo.png');

type Props = ClientTabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { currentUser } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const drawer = useSettingsDrawer();

  const [showOnboarding, setShowOnboarding] = useState(false);

  // Request permissions on first launch + check onboarding
  useEffect(() => {
    (async () => {
      await requestNotificationPermission();
      await requestLocationPermission();
    })();
    shouldShowSenderOnboarding().then((show) => {
      if (show) setShowOnboarding(true);
    });
  }, []);

  const { deliveries, isLoading, refresh } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
    statusFilter: ['new', 'pending', 'waiting', 'picked_up'],
  });

  const { expenses } = useSenderExpenses(currentUser?.uid);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [expensesTab, setExpensesTab] = useState<string>('thisWeek');

  const recentDeliveries = deliveries.slice(0, 5);
  const fullName = currentUser?.fullName || '';
  const firstName = fullName.split(' ')[0] || fullName;
  const rating = currentUser?.ratingAsSender?.average;
  const deliveryCount = currentUser?.completedDeliveries ?? 0;
  const currentExpenses = expenses[expensesTab as keyof typeof expenses] || expenses.thisWeek;

  const handleCreateDelivery = useCallback(() => {
    navigation.navigate('CreateDelivery');
  }, [navigation]);

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('SenderDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  const renderHeader = (): React.JSX.Element => (
    <View>
      {/* ── Blue Header ── */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + SPACING.sm }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

        {/* Top row: logo centered, gear absolute on end */}
        <View style={styles.headerTopRow}>
          <View style={styles.logoCircle}>
            <Image source={logo} style={[styles.logoImage, { tintColor: '#FFFFFF' }]} resizeMode="contain" />
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={drawer.open}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <Text style={[styles.greeting, { color: colors.headerText }]}>
          {t('home.greeting', { name: firstName })}
        </Text>
        <Text style={[styles.subtitle, { color: colors.headerTextSecondary }]}>
          {t('home.subtitle')}
        </Text>

        {/* CTA Button */}
        <AnimatedButton
          title={t('home.newDeliveryCta')}
          onPress={handleCreateDelivery}
          variant="accent"
          style={styles.ctaButton}
        />
      </View>

      {/* ── Welcome Text ── */}
      <View style={styles.welcomeSection}>
        <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
          {t('home.welcomeTitle')}
        </Text>
        <Text style={[styles.welcomeBody, { color: colors.textSecondary }]}>
          {t('home.welcomeBody')}
        </Text>
        <Text style={[styles.chooseWay, { color: colors.textSecondary }]}>
          {t('home.chooseWay')}
        </Text>

        <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
        <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
          {t('common.tagline')}
        </Text>
      </View>
    </View>
  );

  const renderFooter = (): React.JSX.Element => (
    <View>
      {/* ── Expenses Dashboard (collapsible) ── */}
      <View style={[styles.sectionCard, styles.expensesCard, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: '#E53935', borderStartWidth: 4 }]}>
        <Pressable onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpensesOpen((prev) => !prev);
        }} style={styles.expensesHeader}>
          <Text style={[styles.expensesTitle, { color: colors.textPrimary }]}>
            💸 {strings.deliveryExtra.totalExpenses.he}
          </Text>
          <View style={styles.expensesEndRow}>
            <Text style={[styles.expensesQuickTotal, { color: '#E53935' }]}>
              {formatCurrency(currentExpenses.total)}
            </Text>
            <Text style={[styles.expensesArrow, { color: colors.textTertiary }]}>
              {expensesOpen ? '▼' : '◀'}
            </Text>
          </View>
        </Pressable>

        {expensesOpen && (
          <View style={{ marginTop: SPACING.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
              <View style={styles.expensesTabsRow}>
                {EXPENSES_TABS.map((tab) => (
                  <Pressable
                    key={tab.key}
                    onPress={() => setExpensesTab(tab.key)}
                    style={[
                      styles.expensesTab,
                      {
                        backgroundColor: expensesTab === tab.key ? colors.primary : colors.surface,
                        borderColor: expensesTab === tab.key ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.expensesTabText,
                      { color: expensesTab === tab.key ? colors.textInverse : colors.textPrimary },
                    ]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.expensesStatsRow}>
              <View style={styles.expensesStat}>
                <Text style={[styles.expensesStatValue, { color: '#E53935' }]}>
                  {formatCurrency(currentExpenses.total)}
                </Text>
                <Text style={[styles.expensesStatLabel, { color: colors.textSecondary }]}>{strings.commonExtra.total.he}</Text>
              </View>
              <View style={[styles.expensesDivider, { backgroundColor: colors.border }]} />
              <View style={styles.expensesStat}>
                <Text style={[styles.expensesStatValue, { color: colors.primary }]}>
                  {currentExpenses.count}
                </Text>
                <Text style={[styles.expensesStatLabel, { color: colors.textSecondary }]}>{strings.home.deliveries.he}</Text>
              </View>
              <View style={[styles.expensesDivider, { backgroundColor: colors.border }]} />
              <View style={styles.expensesStat}>
                <Text style={[styles.expensesStatValue, { color: colors.textPrimary }]}>
                  {currentExpenses.totalDistanceKm} {strings.commonExtra.km.he}
                </Text>
                <Text style={[styles.expensesStatLabel, { color: colors.textSecondary }]}>{strings.commonExtra.distance.he}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.sectionCard, styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: colors.primary, borderStartWidth: 3 }]}>
          <Text style={styles.statEmoji}>📦</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{deliveryCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.deliveries')}</Text>
        </View>
        <View style={[styles.sectionCard, styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: colors.success, borderStartWidth: 3 }]}>
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{rating ? rating.toFixed(1) : '—'}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.rating')}</Text>
        </View>
      </View>
      <View style={styles.footerSpacer} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={isLoading ? [] : recentDeliveries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <DeliveryCard
              delivery={item}
              onPress={() => handleDeliveryPress(item.id)}
            />
          </View>
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletonContainer}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon="package"
              message={t('home.noActiveDeliveries')}
              submessage={t('home.tapNewDelivery')}
            />
          )
        }
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
      <SenderOnboarding visible={showOnboarding} onDone={() => setShowOnboarding(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Blue Header ──
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
  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 160,
    height: 70,
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
    marginBottom: SPACING.xl,
  },
  ctaButton: {
    width: '100%',
    marginBottom: SPACING.sm,
  },
  // ── Welcome Text ──
  welcomeSection: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 20,
    alignItems: 'center',
  },
  welcomeTitle: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  welcomeBody: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  chooseWay: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  brandLogo: {
    width: 100,
    height: 35,
    alignSelf: 'center',
    marginBottom: SPACING.xs,
  },
  brandTagline: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginBottom: 0,
  },
  // ── 3D Card ──
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
  // ── Expenses Dashboard ──
  expensesCard: {
    marginHorizontal: SPACING.xxl,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  expensesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expensesTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  expensesEndRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  expensesQuickTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  expensesArrow: {
    fontSize: 14,
    fontWeight: '600',
  },
  expensesTabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  expensesTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  expensesTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expensesStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.sm,
  },
  expensesStat: {
    alignItems: 'center',
    flex: 1,
  },
  expensesStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  expensesStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  expensesDivider: {
    width: 1,
    height: 32,
  },
  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  statValue: {
    ...TYPOGRAPHY.h2,
    fontWeight: '800',
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  // ── Footer ──
  footerSpacer: {
    height: SPACING.xxxl,
  },
  // ── List ──
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  cardWrapper: {
    paddingHorizontal: 16,
  },
  skeletonContainer: {
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.md,
  },
});
