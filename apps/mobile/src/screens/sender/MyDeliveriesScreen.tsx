import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { DeliveryCard } from '../../components/DeliveryCard';
import { EmptyState } from '../../components/EmptyState';

type Props = NativeStackScreenProps<RootStackParamList, 'SenderTabs'>;

type TabKey = 'active' | 'completed' | 'cancelled';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'פעילים' /* Active */ },
  { key: 'completed', label: 'הושלמו' /* Completed */ },
  { key: 'cancelled', label: 'בוטלו' /* Cancelled */ },
];

const STATUS_MAP: Record<TabKey, string[]> = {
  active: ['pending', 'matched', 'picked_up', 'in_transit'],
  completed: ['delivered'],
  cancelled: ['cancelled'],
};

/**
 * MyDeliveriesScreen — המשלוחים שלי
 * List with tabs: Active, Completed, Cancelled.
 * רשימה עם טאבים: פעילים, הושלמו, בוטלו
 */
export function MyDeliveriesScreen({ navigation }: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const { currentUser } = useAuth();
  const { deliveries, isLoading, refresh } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
    statusFilter: STATUS_MAP[activeTab],
  });

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('SenderDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  const emptyMessages: Record<TabKey, { message: string; submessage: string }> = {
    active: {
      message: 'אין משלוחים פעילים',
      submessage: 'צור משלוח חדש מהמסך הראשי',
    },
    completed: {
      message: 'אין משלוחים שהושלמו',
      submessage: 'משלוחים שהושלמו יופיעו כאן',
    },
    cancelled: {
      message: 'אין משלוחים שבוטלו',
      submessage: 'משלוחים שבוטלו יופיעו כאן',
    },
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>המשלוחים שלי</Text>
        {/* My Deliveries */}
      </View>

      {/* Tab bar */}
      {/* טאבים */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Delivery list */}
      {/* רשימת משלוחים */}
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DeliveryCard delivery={item} onPress={() => handleDeliveryPress(item.id)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="package"
            message={emptyMessages[activeTab].message}
            submessage={emptyMessages[activeTab].submessage}
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'right',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
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
