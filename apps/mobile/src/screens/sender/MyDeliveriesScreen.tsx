import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { SenderTabScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { DeliveryCard } from '../../components/DeliveryCard';
import { EmptyState } from '../../components/EmptyState';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';

type Props = SenderTabScreenProps<'MyDeliveries'>;

type TabKey = 'active' | 'completed' | 'cancelled';

const STATUS_MAP: Record<TabKey, string[]> = {
  active: ['new', 'pending', 'waiting', 'picked_up'],
  completed: ['delivered', 'completed_paid'],
  cancelled: ['cancelled'],
};

/**
 * MyDeliveriesScreen — המשלוחים שלי
 * List with tabs: Active, Completed, Cancelled.
 * רשימה עם טאבים: פעילים, הושלמו, בוטלו
 */
export function MyDeliveriesScreen({ navigation }: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const { colors } = useTheme();
  const drawer = useSettingsDrawer();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { deliveries, isLoading, refresh } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
    statusFilter: STATUS_MAP[activeTab],
  });

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'active', label: t('delivery.active') },
    { key: 'completed', label: t('delivery.completed') },
    { key: 'cancelled', label: t('delivery.cancelled') },
  ];

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('SenderDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  const emptyMessages: Record<TabKey, { message: string; submessage: string }> = {
    active: {
      message: t('delivery.noActive'),
      submessage: t('delivery.noActiveHint'),
    },
    completed: {
      message: t('delivery.noCompleted'),
      submessage: t('delivery.noCompletedHint'),
    },
    cancelled: {
      message: t('delivery.noCancelled'),
      submessage: t('delivery.noCancelledHint'),
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TabHeader title={t('delivery.myDeliveries')} onSettingsPress={drawer.open} />

      {/* Tab bar */}
      <View style={[styles.tabBarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                { backgroundColor: colors.surface, borderColor: colors.border },
                activeTab === tab.key && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[
                styles.tabText,
                { color: colors.textSecondary },
                activeTab === tab.key && styles.tabTextActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Delivery list */}
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
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={[
          styles.listContent,
          deliveries.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
      />
      <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  tabBarCard: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
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
