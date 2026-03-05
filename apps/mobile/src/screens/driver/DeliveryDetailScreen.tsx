import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { StatusBadge } from '../../components/StatusBadge';
import { AvatarCircle } from '../../components/AvatarCircle';
import { LoadingScreen } from '../../components/LoadingScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDeliveryDetail'>;

/**
 * DeliveryDetailScreen (Driver) — מסך פרטי משלוח לנהג
 * Delivery details with "Express Interest" button.
 * פרטי משלוח עם כפתור "הבעת עניין"
 */
export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { getDeliveryById, expressInterest, updateDeliveryStatus, isLoading } = useDelivery({ userId: currentUser?.uid, role: 'driver' });
  const delivery = getDeliveryById(deliveryId);

  const handleExpressInterest = async (): Promise<void> => {
    try {
      await expressInterest(deliveryId, currentUser!.uid);
      Alert.alert('', t('driver.interestSent'));
    } catch (err) {
      Alert.alert('', t('driver.interestError'));
    }
  };

  const handleStatusUpdate = async (
    newStatus: 'picked_up' | 'in_transit' | 'delivered',
  ): Promise<void> => {
    try {
      await updateDeliveryStatus(deliveryId, newStatus);
      Alert.alert('', t('driver.statusUpdated'));
    } catch (err) {
      Alert.alert('', t('driver.statusUpdateError'));
    }
  };

  if (isLoading || !delivery) {
    return <LoadingScreen />;
  }

  const isMyJob = delivery.driverId === currentUser?.uid;
  const isPending = delivery.status === 'pending';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      {/* Status */}
      <View style={styles.statusRow}>
        <StatusBadge status={delivery.status} />
        <Text style={[styles.deliveryId, { color: colors.textSecondary }]}>#{deliveryId.slice(0, 8)}</Text>
      </View>

      {/* Route info */}
      <View style={[styles.routeSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
          <View style={styles.routeInfo}>
            <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>{t('delivery.pickup')}</Text>
            <Text style={[styles.routeAddress, { color: colors.textPrimary }]}>{delivery.pickup?.address || '—'}</Text>
          </View>
        </View>
        <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
          <View style={styles.routeInfo}>
            <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>{t('delivery.destination')}</Text>
            <Text style={[styles.routeAddress, { color: colors.textPrimary }]}>{delivery.destination?.address || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Item details */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('driver.itemDetails')}</Text>
        <Text style={[styles.itemDescription, { color: colors.textPrimary }]}>{delivery.itemDescription}</Text>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.size')}:</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{delivery.itemSize || '—'}</Text>
        </View>
        {delivery.photoUrl && (
          <Image source={{ uri: delivery.photoUrl }} style={styles.itemPhoto} />
        )}
      </View>

      {/* Price */}
      <View style={[styles.priceSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>{t('driver.payment')}</Text>
        <Text style={[styles.priceValue, { color: colors.success }]}>₪{delivery.suggestedPrice || 0}</Text>
      </View>

      {/* Sender info */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('driver.theSender')}</Text>
        <View style={styles.userCard}>
          <AvatarCircle
            name={delivery.senderName || ''}
            photoUrl={delivery.senderPhotoUrl}
            size={40}
          />
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>{delivery.senderName}</Text>
            <Text style={[styles.userRating, { color: colors.textSecondary }]}>
              {delivery.senderRating ? `${delivery.senderRating.toFixed(1)} ★` : t('delivery.newDriver')}
            </Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      {delivery.notes && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('driver.notes')}</Text>
          <Text style={[styles.notesText, { color: colors.textSecondary }]}>{delivery.notes}</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionsSection}>
        {isPending && !isMyJob && (
          <TouchableOpacity style={[styles.interestButton, { backgroundColor: colors.primary }]} onPress={handleExpressInterest}>
            <Text style={styles.interestButtonText}>{t('driver.expressInterest')}</Text>
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'matched' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => handleStatusUpdate('picked_up')}
          >
            <Text style={styles.actionButtonText}>{t('driver.confirmPickup')}</Text>
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'picked_up' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => handleStatusUpdate('in_transit')}
          >
            <Text style={styles.actionButtonText}>{t('driver.onMyWay')}</Text>
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'in_transit' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={() => handleStatusUpdate('delivered')}
          >
            <Text style={styles.actionButtonText}>{t('driver.confirmDelivery')}</Text>
          </TouchableOpacity>
        )}

        {isMyJob && (
          <TouchableOpacity
            style={[styles.chatButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            onPress={() =>
              navigation.navigate('ChatRoom', {
                chatId: delivery.chatId || '',
                recipientName: delivery.senderName || '',
              })
            }
          >
            <Text style={[styles.chatButtonText, { color: colors.primary }]}>{t('driver.chatWithSender')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  deliveryId: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  routeSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  routeAddress: {
    fontSize: 15,
    textAlign: 'right',
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 20,
    marginRight: 5,
    marginVertical: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
  },
  itemPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 12,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userRating: {
    fontSize: 13,
  },
  notesText: {
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 20,
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  interestButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  interestButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  chatButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
