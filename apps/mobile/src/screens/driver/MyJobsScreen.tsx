import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { DriverTabScreenProps } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { DeliveryCard } from '../../components/DeliveryCard';
import { EmptyState } from '../../components/EmptyState';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';

type Props = DriverTabScreenProps<'MyJobs'>;

type TabKey = 'active' | 'completed';

const STATUS_MAP: Record<TabKey, string[]> = {
  active: ['matched', 'picked_up', 'in_transit'],
  completed: ['delivered'],
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
    textAlign: 'right',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 30,
    marginBottom: 16,
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
