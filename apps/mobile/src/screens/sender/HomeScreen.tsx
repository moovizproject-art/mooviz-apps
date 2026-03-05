import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Image,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClientTabScreenProps } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { GlassCard } from '../../components/GlassCard';
import { AnimatedButton } from '../../components/AnimatedButton';
import { DeliveryCard } from '../../components/DeliveryCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/tokens';

const logo = require('../../assets/logo.png');

type Props = ClientTabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { currentUser } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const drawer = useSettingsDrawer();

  const { deliveries, isLoading, refresh } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
    statusFilter: ['pending', 'matched', 'picked_up', 'in_transit'],
  });

  const recentDeliveries = deliveries.slice(0, 5);
  const fullName = currentUser?.fullName || '';
  const firstName = fullName.split(' ')[0] || fullName;
  const rating = currentUser?.ratingAsSender?.average;
  const deliveryCount = currentUser?.completedDeliveries ?? 0;

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
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

        {/* Top row: logo centered, gear absolute on end */}
        <View style={styles.headerTopRow}>
          <View style={[styles.logoCircle, { backgroundColor: '#FFFFFF' }]}>
            <Image source={logo} style={styles.logoImage} resizeMode="contain" />
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

        <Text style={[styles.brandName, { color: colors.primary }]}>
          {t('common.appName')}
        </Text>
        <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
          {t('common.tagline')}
        </Text>
      </View>
    </View>
  );

  const renderFooter = (): React.JSX.Element => (
    <View>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <GlassCard style={{ ...styles.statCard, backgroundColor: colors.surface }} padding="md">
          <Text style={styles.statEmoji}>📦</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{deliveryCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.deliveries')}</Text>
        </GlassCard>
        <GlassCard style={{ ...styles.statCard, backgroundColor: colors.surface }} padding="md">
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{rating ? rating.toFixed(1) : '—'}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.rating')}</Text>
        </GlassCard>
      </View>
      <View style={styles.footerSpacer} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        data={isLoading ? [] : recentDeliveries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DeliveryCard
            delivery={item}
            onPress={() => handleDeliveryPress(item.id)}
          />
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
    </SafeAreaView>
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
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  brandTagline: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginBottom: 0,
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
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.sm,
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
  skeletonContainer: {
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.md,
  },
});
