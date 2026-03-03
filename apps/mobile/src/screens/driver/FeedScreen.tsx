import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Slider from '@react-native-community/slider';

import { DriverTabScreenProps } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useDelivery } from '../../hooks/useDelivery';
import { useLocation } from '../../hooks/useLocation';
import { DeliveryCard } from '../../components/DeliveryCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { MAX_DELIVERY_RADIUS_KM } from '../../constants/config';

type Props = DriverTabScreenProps<'Feed'>;

/**
 * FeedScreen (Driver) — פיד משלוחים זמינים
 * Available deliveries with radius filter, geohash-based proximity query.
 * משלוחים זמינים עם סינון לפי רדיוס, שאילתות מבוססות geohash
 */
export function FeedScreen({ navigation }: Props): React.JSX.Element {
  const [radiusKm, setRadiusKm] = useState<number>(10);
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

  if (locationLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>משלוחים זמינים</Text>
        {/* Available deliveries */}
      </View>

      {/* Radius filter */}
      {/* סינון לפי מרחק */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterLabel}>רדיוס חיפוש</Text>
          {/* Search radius */}
          <Text style={styles.filterValue}>{radiusKm} ק״מ</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={MAX_DELIVERY_RADIUS_KM}
          step={1}
          value={radiusKm}
          onValueChange={setRadiusKm}
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor={COLORS.border}
          thumbTintColor={COLORS.primary}
        />
      </View>

      {/* Location status */}
      {/* מצב מיקום */}
      {!location && (
        <View style={styles.locationWarning}>
          <Text style={styles.locationWarningText}>
            לא ניתן לאתר את מיקומך. בדוק הרשאות GPS.
          </Text>
          {/* Cannot determine location. Check GPS permissions. */}
        </View>
      )}

      {/* Available deliveries list */}
      {/* רשימת משלוחים זמינים */}
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DeliveryCard
            delivery={item}
            onPress={() => handleDeliveryPress(item.id)}
            showDistance
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="search"
            message="אין משלוחים זמינים באזורך"
            submessage="נסה להגדיל את רדיוס החיפוש"
            /* No deliveries in your area / Try increasing radius */
          />
        }
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        contentContainerStyle={[
          styles.listContent,
          deliveries.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'right',
  },
  filterSection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  filterValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  locationWarning: {
    marginHorizontal: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.warningBg,
    marginBottom: 12,
  },
  locationWarningText: {
    fontSize: 13,
    color: COLORS.warning,
    textAlign: 'right',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
});
