import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SenderTabScreenProps } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { DeliveryCard } from '../../components/DeliveryCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';

type Props = SenderTabScreenProps<'Home'>;

/**
 * HomeScreen (Sender) — מסך הבית של השולח
 * Create new delivery CTA + list of active deliveries.
 * כפתור יצירת משלוח חדש + רשימת משלוחים פעילים
 */
export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { currentUser } = useAuth();
  const { deliveries, isLoading, refresh } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
    statusFilter: ['pending', 'matched', 'picked_up', 'in_transit'],
  });

  const handleCreateDelivery = useCallback(() => {
    navigation.navigate('CreateDelivery');
  }, [navigation]);

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('SenderDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Welcome header */}
      {/* כותרת ברוך הבא */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          שלום, {currentUser?.displayName || 'משתמש'}
        </Text>
        {/* Hello, [name] */}
        <Text style={styles.headerSubtitle}>מה נשלח היום?</Text>
        {/* What are we sending today? */}
      </View>

      {/* Create delivery CTA */}
      {/* כפתור יצירת משלוח */}
      <TouchableOpacity style={styles.createButton} onPress={handleCreateDelivery}>
        <Text style={styles.createButtonIcon}>+</Text>
        <Text style={styles.createButtonText}>משלוח חדש</Text>
        {/* New delivery */}
      </TouchableOpacity>

      {/* Active deliveries list */}
      {/* רשימת משלוחים פעילים */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>משלוחים פעילים</Text>
        {/* Active deliveries */}
        <FlatList
          data={deliveries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DeliveryCard
              delivery={item}
              onPress={() => handleDeliveryPress(item.id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="package"
              message="אין משלוחים פעילים"
              submessage="לחץ על 'משלוח חדש' כדי להתחיל"
              /* No active deliveries / Tap 'New delivery' to start */
            />
          }
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
          contentContainerStyle={deliveries.length === 0 ? styles.emptyList : undefined}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
    paddingBottom: 16,
    backgroundColor: COLORS.primary,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    marginTop: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    marginHorizontal: 24,
    marginTop: -20,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    gap: 8,
  },
  createButtonIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: 12,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
});
