import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClientTabScreenProps } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { GlassCard } from '../../components/GlassCard';
import { AnimatedButton } from '../../components/AnimatedButton';
import { DeliveryCard } from '../../components/DeliveryCard';
import { ModeSwitcher } from '../../components/ModeSwitcher';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { BRAND, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants/design';

type Props = ClientTabScreenProps<'Home'>;

/**
 * HomeScreen (Sender) — מסך הבית של השולח
 * Glass morphism design with welcome greeting, mode switcher,
 * new delivery CTA and recent deliveries list.
 * עיצוב זכוכית עם ברכת שלום, מתג מצב, כפתור יצירת משלוח ומשלוחים אחרונים
 */
export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { currentUser } = useAuth();
  const [activeMode, setActiveMode] = useState<'client' | 'driver'>('client');

  const { deliveries, isLoading, refresh } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
    statusFilter: ['pending', 'matched', 'picked_up', 'in_transit'],
  });

  const recentDeliveries = deliveries.slice(0, 3);
  const driverUnlocked = currentUser?.role === 'both';

  const handleCreateDelivery = useCallback(() => {
    navigation.navigate('CreateDelivery');
  }, [navigation]);

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('SenderDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  const handleModeToggle = useCallback(
    (mode: 'client' | 'driver') => {
      if (mode === 'driver' && !driverUnlocked) {
        navigation.navigate('DriverKYC');
        return;
      }
      setActiveMode(mode);
    },
    [navigation, driverUnlocked],
  );

  const renderHeader = (): React.JSX.Element => (
    <View>
      {/* Welcome header */}
      {/* כותרת ברכת שלום */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>
              שלום, {currentUser?.displayName || 'משתמש'}
            </Text>
            <Text style={styles.subtitle}>מה נשלח היום?</Text>
          </View>
          <ModeSwitcher
            activeMode={activeMode}
            onToggle={handleModeToggle}
            driverUnlocked={driverUnlocked}
          />
        </View>
      </View>

      {/* Create delivery CTA */}
      {/* כפתור יצירת משלוח */}
      <View style={styles.ctaContainer}>
        <GlassCard style={styles.ctaCard} padding="xl">
          <Text style={styles.ctaTitle}>שלח משלוח חדש</Text>
          <Text style={styles.ctaSubtitle}>מצא נהג באזורך תוך דקות</Text>
          <AnimatedButton
            title="משלוח חדש"
            onPress={handleCreateDelivery}
            variant="accent"
            style={styles.ctaButton}
          />
        </GlassCard>
      </View>

      {/* Statistics summary */}
      {/* סיכום סטטיסטיקות */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard} padding="md">
          <Text style={styles.statValue}>
            {currentUser?.totalDeliveries ?? 0}
          </Text>
          <Text style={styles.statLabel}>משלוחים</Text>
        </GlassCard>
        <GlassCard style={styles.statCard} padding="md">
          <Text style={styles.statValue}>
            {currentUser?.rating?.toFixed(1) ?? '—'}
          </Text>
          <Text style={styles.statLabel}>דירוג</Text>
        </GlassCard>
      </View>

      {/* Section title */}
      <Text style={styles.sectionTitle}>משלוחים פעילים</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon="package"
              message="אין משלוחים פעילים"
              submessage="לחץ על 'משלוח חדש' כדי להתחיל"
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={BRAND.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          !isLoading && recentDeliveries.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    backgroundColor: BRAND.primary,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
    ...SHADOWS.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingSection: {
    flex: 1,
  },
  greeting: {
    ...TYPOGRAPHY.h1,
    color: BRAND.textInverse,
    textAlign: 'right',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  ctaContainer: {
    paddingHorizontal: SPACING.xxl,
    marginTop: -SPACING.xl,
  },
  ctaCard: {
    alignItems: 'center',
  },
  ctaTitle: {
    ...TYPOGRAPHY.h2,
    color: BRAND.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  ctaSubtitle: {
    ...TYPOGRAPHY.caption,
    color: BRAND.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  ctaButton: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h1,
    color: BRAND.primary,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    textAlign: 'right',
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.md,
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
