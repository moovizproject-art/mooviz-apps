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
import { DriverTabScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { useDriverLocationTracking } from '../../hooks/useDriverLocationTracking';
import { DeliveryCard } from '../../components/DeliveryCard';
import { EmptyState } from '../../components/EmptyState';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';

type Props = DriverTabScreenProps<'MyJobs'>;

type TabKey = 'active' | 'completed';

const STATUS_MAP: Record<TabKey, string[]> = {
  active: ['pending', 'waiting', 'picked_up', 'delivered'],
  completed: ['completed_paid'],
};

/**
 * MyJobsScreen (Driver) — העבודות שלי
 * Driver's accepted deliveries with Active/Completed tabs.
 * משלוחים שהנהג קיבל עם טאבים פעיל/הושלם
 */
export function MyJobsScreen({ navigation }: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const drawer = useSettingsDrawer();

  // Keep location tracking active across all driver tabs
  const { deliveries: activeJobs } = useDelivery({
    userId: currentUser?.uid,
    role: 'driver',
    statusFilter: ['waiting', 'picked_up'],
  });
  useDriverLocationTracking({
    userId: currentUser?.uid,
    isDriver: true,
    activeDeliveryStatus: activeJobs[0]?.status,
  });

  const { deliveries, isLoading, refresh } = useDelivery({
    userId: currentUser?.uid,
    role: 'driver',
    statusFilter: STATUS_MAP[activeTab],
  });

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'active', label: t('delivery.active') },
    { key: 'completed', label: t('delivery.completed') },
  ];

  const handleDeliveryPress = useCallback(
    (deliveryId: string) => {
      navigation.navigate('DriverDeliveryDetail', { deliveryId });
    },
    [navigation],
  );

  const emptyMessages: Record<TabKey, { message: string; submessage: string }> = {
    active: {
      message: t('driver.noActiveJobs'),
      submessage: t('driver.searchFeedHint'),
    },
    completed: {
      message: t('driver.noCompletedJobs'),
      submessage: t('driver.completedJobsHint'),
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TabHeader title={t('driver.myJobs')} onSettingsPress={drawer.open} />

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

      {/* Jobs list */}
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DeliveryCard delivery={item} onPress={() => handleDeliveryPress(item.id)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase"
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
