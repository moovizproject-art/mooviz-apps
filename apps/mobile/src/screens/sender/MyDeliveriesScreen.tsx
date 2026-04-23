import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  active: ['new', 'pending', 'awaiting_confirm', 'waiting_for_pickup', 'picked_up', 'delivered', 'awaiting_payment'],
  completed: ['completed_paid'],
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

  // Track which cards the user has opened (to show unread bold border)
  const seenIds = useRef<Set<string>>(new Set());

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      seenIds.current.add(deliveryId);
      navigation.navigate('SenderDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  // Split active deliveries into 3 sections: attention (drivers waiting), payment (awaiting payment), regular
  // Use stable ID sets to prevent FlatList flickering when interestedDrivers updates
  const { sortedData, attentionIds, paymentIds, attentionCount, paymentCount } = useMemo(() => {
    if (activeTab !== 'active') return { sortedData: deliveries, attentionIds: new Set<string>(), paymentIds: new Set<string>(), attentionCount: 0, paymentCount: 0 };
    const attention: typeof deliveries = [];
    const payment: typeof deliveries = [];
    const regular: typeof deliveries = [];
    const aIds = new Set<string>();
    const pIds = new Set<string>();
    for (const d of deliveries) {
      if (['delivered', 'awaiting_payment'].includes(d.status)) {
        payment.push(d);
        pIds.add(d.id);
      } else {
        const hasDrivers = (d as any).interestedDrivers?.some(
          (dr: any) => dr.status === 'interested' || dr.status === 'confirmed'
        );
        if (hasDrivers) {
          attention.push(d);
          aIds.add(d.id);
        } else {
          regular.push(d);
        }
      }
    }
    return {
      sortedData: [...attention, ...payment, ...regular],
      attentionIds: aIds,
      paymentIds: pIds,
      attentionCount: attention.length,
      paymentCount: payment.length,
    };
  }, [deliveries, activeTab]);

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

      {/* Delivery list — all tabs use FlatList data for virtualization */}
      <FlatList
        data={sortedData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isAttention = attentionIds.has(item.id);
          const isPayment = paymentIds.has(item.id);
          return (
            <View style={isAttention ? styles.attentionCard : undefined}>
              <DeliveryCard
                delivery={item}
                onPress={() => handleDeliveryPress(item.id)}
                isUnread={(isAttention || isPayment) && !seenIds.current.has(item.id)}
                showDriverCount
              />
            </View>
          );
        }}
        ListHeaderComponent={activeTab === 'active' ? (
          <View>
            {attentionCount > 0 && (
              <View style={[styles.attentionHeader, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Text style={[styles.attentionTitle, { color: colors.primary }]}>
                  🔔 {t('sender.driversWaiting')} ({attentionCount})
                </Text>
              </View>
            )}
            {paymentCount > 0 && (
              <View style={[styles.attentionHeader, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
                <Text style={[styles.attentionTitle, { color: '#F57C00' }]}>
                  💳 {t('sender.paymentsWaiting')} ({paymentCount})
                </Text>
              </View>
            )}
          </View>
        ) : undefined}
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
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  attentionSection: {
    marginBottom: 12,
  },
  attentionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  attentionCard: {
    marginBottom: 8,
  },
  regularHeader: {
    paddingVertical: 8,
    borderTopWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  regularTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
});
