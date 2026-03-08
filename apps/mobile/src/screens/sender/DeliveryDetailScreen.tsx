import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { LiveMapView } from '../../components/LiveMapView';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useDelivery } from '../../hooks/useDelivery';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../../components/StatusBadge';
import { AvatarCircle } from '../../components/AvatarCircle';
import { LoadingScreen } from '../../components/LoadingScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'SenderDeliveryDetail'>;

/**
 * DeliveryDetailScreen (Sender) — מסך פרטי משלוח לשולח
 * Full delivery view: status timeline, driver info, map, chat button.
 * תצוגה מלאה: ציר זמן סטטוס, פרטי נהג, מפה, כפתור צ׳אט
 */
export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { getDeliveryById, isLoading, confirmPayment } = useDelivery({ userId: currentUser?.uid, role: 'sender' });
  const delivery = getDeliveryById(deliveryId);

  // Fetch driver profile for live map (phone, name)
  const [driverProfile, setDriverProfile] = useState<any>(null);

  useEffect(() => {
    if (!delivery?.driverId) return;
    const unsub = firestore().doc(`users/${delivery.driverId}`).onSnapshot(snap => {
      if (snap.exists) setDriverProfile({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [delivery?.driverId]);

  // Build status timeline steps
  const timelineSteps = useMemo(() => {
    const steps = [
      { key: 'pending', label: t('delivery.waitingForDriver') },
      { key: 'matched', label: t('delivery.driverFound') },
      { key: 'picked_up', label: t('status.pickedUp') },
      { key: 'in_transit', label: t('status.inTransit') },
      { key: 'delivered', label: t('status.delivered') },
    ];
    return steps;
  }, [t]);

  if (isLoading || !delivery) {
    return <LoadingScreen />;
  }

  const currentStepIndex = timelineSteps.findIndex((s) => s.key === delivery.status);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      {/* Status badge */}
      <View style={styles.statusSection}>
        <StatusBadge status={delivery.status} />
      </View>

      {/* Status timeline */}
      <View style={styles.timelineSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('delivery.deliveryTracking')}</Text>
        {timelineSteps.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <View key={step.key} style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  { backgroundColor: colors.border },
                  isCompleted && { backgroundColor: colors.success },
                  isCurrent && styles.timelineDotCurrent,
                  isCurrent && { backgroundColor: colors.primary },
                ]}
              />
              {index < timelineSteps.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    { backgroundColor: colors.border },
                    isCompleted && { backgroundColor: colors.success },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.timelineLabel,
                  { color: colors.textSecondary },
                  isCompleted && { color: colors.textPrimary, fontWeight: '600' },
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Delivery details */}
      <View style={styles.detailsSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('delivery.deliveryDetails')}</Text>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.from')}:</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{delivery.pickup?.address || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.to')}:</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{delivery.destination?.address || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.item')}:</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{delivery.itemDescription || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.priceLabel')}:</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>₪{delivery.suggestedPrice || 0}</Text>
        </View>

        {delivery.photoUrl && (
          <Image source={{ uri: delivery.photoUrl }} style={styles.itemPhoto} />
        )}
      </View>

      {/* Live map or placeholder */}
      {['waiting', 'picked_up', 'delivered'].includes(delivery.status) && delivery.driverId ? (
        <LiveMapView
          pickup={{
            latitude: delivery.pickup?.latitude || delivery.pickup?.lat || 32.0853,
            longitude: delivery.pickup?.longitude || delivery.pickup?.lng || 34.7818,
            address: delivery.pickup?.address,
          }}
          destination={{
            latitude: delivery.destination?.latitude || delivery.destination?.lat || 32.0853,
            longitude: delivery.destination?.longitude || delivery.destination?.lng || 34.7818,
            address: delivery.destination?.address,
          }}
          driverId={delivery.driverId}
          driverPhone={driverProfile?.phone}
          chatId={delivery.chatId}
          recipientName={driverProfile?.fullName || t('home.driver')}
          onExpand={() =>
            navigation.navigate('FullScreenMap', {
              pickup: {
                latitude: delivery.pickup?.latitude || delivery.pickup?.lat || 32.0853,
                longitude: delivery.pickup?.longitude || delivery.pickup?.lng || 34.7818,
                address: delivery.pickup?.address,
              },
              destination: {
                latitude: delivery.destination?.latitude || delivery.destination?.lat || 32.0853,
                longitude: delivery.destination?.longitude || delivery.destination?.lng || 34.7818,
                address: delivery.destination?.address,
              },
              driverId: delivery.driverId,
              driverPhone: driverProfile?.phone,
              chatId: delivery.chatId,
              recipientName: driverProfile?.fullName || t('home.driver'),
            })
          }
        />
      ) : (
        <View style={[styles.mapPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.mapPlaceholderText, { color: colors.textSecondary }]}>{t('delivery.mapPlaceholder')}</Text>
        </View>
      )}

      {/* Driver info (when matched) */}
      {delivery.driverId && (
        <View style={styles.driverSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('delivery.driverInfo')}</Text>
          <View style={[styles.driverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AvatarCircle
              name={delivery.driverName || ''}
              photoUrl={delivery.driverPhotoUrl}
              size={48}
            />
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: colors.textPrimary }]}>{delivery.driverName}</Text>
              <Text style={[styles.driverRating, { color: colors.textSecondary }]}>
                {delivery.driverRating ? `${delivery.driverRating.toFixed(1)} ★` : t('delivery.newDriver')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.chatButton, { backgroundColor: colors.primary }]}
              onPress={() =>
                navigation.navigate('ChatRoom', {
                  chatId: delivery.chatId || '',
                  recipientName: delivery.driverName || '',
                })
              }
            >
              <Text style={styles.chatButtonText}>{t('tabs.chat')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Payment confirmation */}
      {delivery.status === 'delivered' && (
        <View style={[styles.paymentSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.paymentTitle, { color: colors.textPrimary }]}>{t('payment.confirmTitle')}</Text>
          <View style={styles.confirmRow}>
            <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('payment.senderStatus')}</Text>
            <Text style={{ color: delivery.payment?.senderConfirmed ? colors.success : colors.textSecondary }}>
              {delivery.payment?.senderConfirmed ? t('payment.confirmed') : t('payment.pending')}
            </Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('payment.driverStatus')}</Text>
            <Text style={{ color: delivery.payment?.driverConfirmed ? colors.success : colors.textSecondary }}>
              {delivery.payment?.driverConfirmed ? t('payment.confirmed') : t('payment.pending')}
            </Text>
          </View>
          {!delivery.payment?.senderConfirmed && (
            <TouchableOpacity
              style={[styles.confirmPaymentButton, { backgroundColor: colors.primary }]}
              onPress={async () => {
                try {
                  await confirmPayment(delivery.id);
                  Alert.alert(t('payment.successTitle'), t('payment.senderConfirmedMsg'));
                } catch (e: any) {
                  Alert.alert(t('common.error'), e.message);
                }
              }}
            >
              <Text style={styles.confirmPaymentButtonText}>{t('payment.confirmButton')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Actions based on status */}
      {delivery.status === 'delivered' && !delivery.rated && (
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: colors.accent }]}
          onPress={() =>
            navigation.navigate('Rating', {
              deliveryId: delivery.id,
              targetUserId: delivery.driverId || '',
            })
          }
        >
          <Text style={styles.rateButtonText}>{t('delivery.rateDriver')}</Text>
        </TouchableOpacity>
      )}
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
  statusSection: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  timelineSection: {
    marginBottom: 24,
    paddingRight: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: 12,
  },
  timelineDotCurrent: {
    borderWidth: 3,
    borderColor: 'rgba(26,115,232,0.3)',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  timelineLine: {
    position: 'absolute',
    right: 22,
    top: 20,
    width: 2,
    height: 24,
  },
  timelineLabel: {
    fontSize: 14,
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  itemPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mapPlaceholderText: {
    fontSize: 14,
  },
  driverSection: {
    marginBottom: 24,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  driverInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
  },
  driverRating: {
    fontSize: 13,
    marginTop: 2,
  },
  chatButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  paymentSection: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  paymentTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  confirmLabel: { fontSize: 14 },
  confirmPaymentButton: { marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmPaymentButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rateButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
