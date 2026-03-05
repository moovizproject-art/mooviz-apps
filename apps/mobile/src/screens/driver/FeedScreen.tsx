import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

import { DriverTabScreenProps } from '../../navigation/types';
import { useDelivery } from '../../hooks/useDelivery';
import { useLocation } from '../../hooks/useLocation';
import { AvailabilityToggle } from '../../components/AvailabilityToggle';
import { DeliveryCard } from '../../components/DeliveryCard';
import { GlassCard } from '../../components/GlassCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { MAX_DELIVERY_RADIUS_KM } from '../../constants/config';
import { BRAND, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants/design';

type Props = DriverTabScreenProps<'Feed'>;

/**
 * FeedScreen (Driver) — פיד משלוחים זמינים
 * Glass morphism design with availability toggle, radius filter,
 * nearby deliveries with pull-to-refresh and skeleton loading.
 * עיצוב זכוכית עם מתג זמינות, סינון רדיוס, משלוחים קרובים
 */
export function FeedScreen({ navigation }: Props): React.JSX.Element {
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const { location, isLoading: locationLoading } = useLocation();

  const { deliveries, isLoading, refresh } = useDelivery({
    role: 'driver',
    statusFilter: ['pending'],
    nearLocation: location
      ? { latitude: location.latitude, longitude: location.longitude }
      : undefined,
    radiusKm,
  });

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('DriverDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  const renderHeader = (): React.JSX.Element => (
    <View>
      {/* Header title */}
      {/* כותרת */}
      <View style={styles.header}>
        <Text style={styles.title}>משלוחים זמינים</Text>
      </View>

      {/* Availability toggle */}
      {/* מתג זמינות */}
      <View style={styles.toggleContainer}>
        <AvailabilityToggle
          isAvailable={isAvailable}
          onToggle={setIsAvailable}
        />
      </View>

      {/* Radius filter */}
      {/* סינון לפי מרחק */}
      <GlassCard style={styles.filterCard} padding="lg">
        <View style={styles.filterHeader}>
          <Text style={styles.filterLabel}>רדיוס חיפוש</Text>
          <Text style={styles.filterValue}>{radiusKm} ק״מ</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={MAX_DELIVERY_RADIUS_KM}
          step={1}
          value={radiusKm}
          onValueChange={setRadiusKm}
          minimumTrackTintColor={BRAND.primary}
          maximumTrackTintColor={BRAND.border}
          thumbTintColor={BRAND.primary}
        />
      </GlassCard>

      {/* Location warning */}
      {/* אזהרת מיקום */}
      {!location && !locationLoading && (
        <View style={styles.locationWarning}>
          <Text style={styles.locationWarningText}>
            לא ניתן לאתר את מיקומך. בדוק הרשאות GPS.
          </Text>
        </View>
      )}

      {/* Results count */}
      {/* מספר תוצאות */}
      {!isLoading && deliveries.length > 0 && (
        <Text style={styles.resultsCount}>
          {deliveries.length} משלוחים באזורך
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon="search"
              message="אין משלוחים זמינים באזורך"
              submessage="נסה להגדיל את רדיוס החיפוש"
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
          !isLoading && deliveries.length === 0 && styles.emptyList,
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
    paddingBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: BRAND.textPrimary,
    textAlign: 'right',
  },
  toggleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
  },
  filterCard: {
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  filterLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: BRAND.textPrimary,
  },
  filterValue: {
    ...TYPOGRAPHY.bodyBold,
    color: BRAND.primary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  locationWarning: {
    marginHorizontal: SPACING.xxl,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: BRAND.warningBg,
    marginBottom: SPACING.md,
  },
  locationWarningText: {
    ...TYPOGRAPHY.caption,
    color: BRAND.warning,
    textAlign: 'right',
  },
  resultsCount: {
    ...TYPOGRAPHY.caption,
    color: BRAND.textSecondary,
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
    textAlign: 'right',
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
