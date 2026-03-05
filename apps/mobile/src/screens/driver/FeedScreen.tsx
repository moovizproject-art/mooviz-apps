import React, { useState, useCallback, useEffect } from 'react';
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
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useDelivery } from '../../hooks/useDelivery';
import { useLocation } from '../../hooks/useLocation';
import { AvailabilityToggle } from '../../components/AvailabilityToggle';
import { DeliveryCard } from '../../components/DeliveryCard';
import { GlassCard } from '../../components/GlassCard';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { MAX_DELIVERY_RADIUS_KM } from '../../constants/config';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants/design';
import { requestLocationPermission, requestNotificationPermission } from '../../utils/permissions';

type Props = DriverTabScreenProps<'Feed'>;

/**
 * FeedScreen (Driver) — פיד משלוחים זמינים
 * Glass morphism design with availability toggle, radius filter,
 * nearby deliveries with pull-to-refresh and skeleton loading.
 * עיצוב זכוכית עם מתג זמינות, סינון רדיוס, משלוחים קרובים
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
      <TabHeader title={t('driver.availableDeliveries')} onSettingsPress={drawer.open} />

      {/* Availability toggle */}
      <View style={styles.toggleContainer}>
        <AvailabilityToggle
          isAvailable={isAvailable}
          onToggle={setIsAvailable}
        />
      </View>

      {/* Radius filter */}
      <GlassCard style={styles.filterCard} padding="lg">
        <View style={styles.filterHeader}>
          <Text style={[styles.filterLabel, { color: colors.textPrimary }]}>{t('driver.searchRadius')}</Text>
          <Text style={[styles.filterValue, { color: colors.primary }]}>{radiusKm} {t('driver.km')}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={MAX_DELIVERY_RADIUS_KM}
          step={1}
          value={radiusKm}
          onValueChange={setRadiusKm}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
      </GlassCard>

      {/* Location warning */}
      {!location && !locationLoading && (
        <View style={[styles.locationWarning, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.locationWarningText, { color: colors.warning }]}>
            {t('driver.locationWarning')}
          </Text>
        </View>
      )}

      {/* Results count */}
      {!isLoading && deliveries.length > 0 && (
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          {deliveries.length} {t('driver.deliveriesInArea')}
        </Text>
      )}
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
  },
  filterValue: {
    ...TYPOGRAPHY.bodyBold,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  locationWarning: {
    marginHorizontal: SPACING.xxl,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  locationWarningText: {
    ...TYPOGRAPHY.caption,
    textAlign: 'right',
  },
  resultsCount: {
    ...TYPOGRAPHY.caption,
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
