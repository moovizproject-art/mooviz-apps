import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  Linking,
  Platform,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';

import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT, Region } from 'react-native-maps';

const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
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

const TIMELINE_STEPS = [
  { key: 'pending', label: 'ממתין לנהג' },
  { key: 'matched', label: 'נהג נמצא' },
  { key: 'picked_up', label: 'נאסף' },
  { key: 'in_transit', label: 'בדרך' },
  { key: 'delivered', label: 'נמסר' },
] as const;

/**
 * DeliveryDetailScreen (Sender) — מסך פרטי משלוח לשולח
 * Scrollable: summary → timeline → map → driver card → images → payment → actions
 */
export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { getDeliveryById, isLoading, confirmPayment } = useDelivery({ userId: currentUser?.uid, role: 'sender' });
  const delivery = getDeliveryById(deliveryId);

  const [driverProfile, setDriverProfile] = useState<any>(null);
  const staticMapRef = useRef<MapView>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  const handleZoom = useCallback((factor: number) => {
    if (!mapRegion || !staticMapRef.current) return;
    const newRegion: Region = {
      ...mapRegion,
      latitudeDelta: mapRegion.latitudeDelta * factor,
      longitudeDelta: mapRegion.longitudeDelta * factor,
    };
    staticMapRef.current.animateToRegion(newRegion, 250);
    setMapRegion(newRegion);
  }, [mapRegion]);

  useEffect(() => {
    if (!delivery?.driverId) return;
    const unsub = firestore().doc(`users/${delivery.driverId}`).onSnapshot(snap => {
      if (snap.exists) setDriverProfile({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [delivery?.driverId]);

  const currentStepIndex = useMemo(() => {
    if (!delivery) return -1;
    return TIMELINE_STEPS.findIndex((s) => s.key === delivery.status);
  }, [delivery?.status]);

  if (isLoading || !delivery) {
    return <LoadingScreen />;
  }

  const pickupCoords = {
    latitude: delivery.pickup?.latitude || delivery.pickup?.lat || 32.0853,
    longitude: delivery.pickup?.longitude || delivery.pickup?.lng || 34.7818,
    address: delivery.pickup?.address,
  };

  const destCoords = {
    latitude: delivery.destination?.latitude || delivery.destination?.lat || 32.0853,
    longitude: delivery.destination?.longitude || delivery.destination?.lng || 34.7818,
    address: delivery.destination?.address,
  };

  const showLiveMap = ['matched', 'waiting', 'picked_up', 'in_transit', 'delivered'].includes(delivery.status) && delivery.driverId;
  const canCancel = ['new', 'pending', 'matched'].includes(delivery.status);
  const showPayment = delivery.status === 'delivered';
  const showRate = delivery.status === 'delivered' && !delivery.rated;
  const hasDriver = !!delivery.driverId;
  const driverName = driverProfile?.fullName || delivery.driverName || '';
  const driverPhoto = driverProfile?.profilePhotoURL || delivery.driverPhotoUrl;
  const driverRating = driverProfile?.ratingAsDriver?.average || delivery.driverRating;
  const driverPhone = driverProfile?.phone;
  const completedTrips = driverProfile?.completedDeliveries;

  // Media: combine mediaURLs + single photoUrl
  const mediaList: string[] = delivery.mediaURLs?.length
    ? delivery.mediaURLs
    : delivery.photoUrl ? [delivery.photoUrl] : [];

  const handleCall = () => {
    if (!driverPhone) return;
    const url = Platform.OS === 'ios' ? `telprompt:${driverPhone}` : `tel:${driverPhone}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleChat = () => {
    navigation.navigate('ChatRoom', {
      chatId: delivery.chatId || '',
      recipientName: driverName,
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. Compact Summary Card ── */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
            {t('delivery.deliveryDetails')}
          </Text>
          <StatusBadge status={delivery.status} />
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.from')}</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={2}>
            {delivery.pickup?.address || '—'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.to')}</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={2}>
            {delivery.destination?.address || '—'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.item')}</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={1}>
            {delivery.itemDescription || '—'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.priceLabel')}</Text>
          <Text style={[styles.priceValue, { color: colors.success }]}>
            ₪{delivery.suggestedPrice || 0}
          </Text>
        </View>
      </View>

      {/* ── 2. Horizontal Status Timeline ── */}
      <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.timeline}>
          {TIMELINE_STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <View
                  style={[
                    styles.timelineSegment,
                    { backgroundColor: colors.border },
                    i <= currentStepIndex && { backgroundColor: colors.success },
                  ]}
                />
              )}
              <View style={styles.timelineStation}>
                <View
                  style={[
                    styles.stationDot,
                    { backgroundColor: colors.border },
                    i < currentStepIndex && { backgroundColor: colors.success },
                    i === currentStepIndex && { backgroundColor: colors.primary, borderWidth: 3, borderColor: 'rgba(26,115,232,0.3)' },
                  ]}
                />
                {i === currentStepIndex && (
                  <Text style={styles.truckIcon}>🚛</Text>
                )}
                <Text
                  style={[
                    styles.stationLabel,
                    { color: colors.textSecondary },
                    i < currentStepIndex && { color: colors.success, fontWeight: '600' },
                    i === currentStepIndex && { color: colors.primary, fontWeight: '700' },
                  ]}
                  numberOfLines={2}
                >
                  {step.label}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* ── 3. Map (always visible, taller) ── */}
      <View style={styles.mapContainer}>
        {showLiveMap ? (
          <LiveMapView
            pickup={pickupCoords}
            destination={destCoords}
            driverId={delivery.driverId!}
            driverPhone={driverPhone}
            chatId={delivery.chatId}
            recipientName={driverName || t('home.driver')}
            hideFabs
            onExpand={() =>
              navigation.navigate('FullScreenMap', {
                pickup: pickupCoords,
                destination: destCoords,
                driverId: delivery.driverId!,
                driverPhone,
                chatId: delivery.chatId,
                recipientName: driverName || t('home.driver'),
              })
            }
          />
        ) : (
          <>
            <MapView
              ref={staticMapRef}
              provider={MAP_PROVIDER}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: (pickupCoords.latitude + destCoords.latitude) / 2,
                longitude: (pickupCoords.longitude + destCoords.longitude) / 2,
                latitudeDelta: Math.abs(pickupCoords.latitude - destCoords.latitude) * 1.8 + 0.01,
                longitudeDelta: Math.abs(pickupCoords.longitude - destCoords.longitude) * 1.8 + 0.01,
              }}
              onRegionChangeComplete={setMapRegion}
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={pickupCoords} pinColor="green" title={pickupCoords.address} />
              <Marker coordinate={destCoords} pinColor="red" title={destCoords.address} />
            </MapView>
          </>
        )}
        {/* Map overlay controls — zoom + fullscreen */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={[styles.mapControlBtn, { backgroundColor: colors.surface }]}
            onPress={() => showLiveMap ? handleZoom(0.5) : handleZoom(0.5)}
          >
            <Text style={[styles.mapControlIcon, { color: colors.textPrimary }]}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapControlBtn, { backgroundColor: colors.surface }]}
            onPress={() => handleZoom(2)}
          >
            <Text style={[styles.mapControlIcon, { color: colors.textPrimary }]}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapControlBtn, { backgroundColor: colors.surface }]}
            onPress={() =>
              navigation.navigate('FullScreenMap', {
                pickup: pickupCoords,
                destination: destCoords,
                driverId: delivery.driverId || '',
              })
            }
          >
            <Text style={[styles.mapControlIcon, { color: colors.textPrimary }]}>⛶</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 4. Driver Card (inline, right under map) ── */}
      {hasDriver && (
        <View style={[styles.driverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Top row: avatar + info */}
          <View style={styles.driverTopRow}>
            <AvatarCircle name={driverName} photoUrl={driverPhoto} size={56} />
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: colors.textPrimary }]} numberOfLines={1}>
                {driverName}
              </Text>
              <View style={styles.driverBadges}>
                {driverRating ? (
                  <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={styles.badgeText}>⭐ {driverRating.toFixed(1)}</Text>
                  </View>
                ) : null}
                {completedTrips != null ? (
                  <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}>
                    <Text style={styles.badgeText}>📦 {completedTrips}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.driverActions}>
            <TouchableOpacity
              style={[styles.driverBtn, { backgroundColor: colors.primary }]}
              onPress={handleChat}
            >
              <Text style={styles.driverBtnIcon}>💬</Text>
              <Text style={styles.driverBtnLabel}>צ׳אט עם הנהג</Text>
            </TouchableOpacity>
            {driverPhone && (
              <TouchableOpacity
                style={[styles.driverBtnSmall, { backgroundColor: colors.success }]}
                onPress={handleCall}
              >
                <Text style={styles.driverBtnIcon}>📞</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── 5. Item Images ── */}
      {mediaList.length > 0 && (
        <View style={styles.mediaSection}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>תמונות הפריט</Text>
          <FlatList
            data={mediaList}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(url, i) => `${i}-${url}`}
            contentContainerStyle={styles.mediaList}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.mediaThumb} />
            )}
          />
        </View>
      )}

      {/* ── 6. Payment Section ── */}
      {showPayment && (
        <View style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.paymentTitle, { color: colors.textPrimary }]}>
            {t('payment.confirmTitle')}
          </Text>

          <View style={styles.confirmRow}>
            <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
              {t('payment.senderStatus')}
            </Text>
            <Text style={{ color: delivery.payment?.senderConfirmed ? colors.success : colors.textSecondary }}>
              {delivery.payment?.senderConfirmed ? t('payment.confirmed') : t('payment.pending')}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
              {t('payment.driverStatus')}
            </Text>
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

      {/* ── 7. Secondary Actions (Cancel / Rate) ── */}
      <View style={styles.secondaryActions}>
        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: '#E53935' }]}
            onPress={() =>
              Alert.alert(
                t('common.confirm'),
                'האם אתה בטוח שברצונך לבטל את המשלוח?',
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('common.confirm'), style: 'destructive', onPress: () => {} },
                ],
              )
            }
          >
            <Text style={styles.cancelBtnText}>ביטול משלוח</Text>
          </TouchableOpacity>
        )}

        {showRate && (
          <TouchableOpacity
            style={[styles.rateBtn, { backgroundColor: colors.accent }]}
            onPress={() =>
              navigation.navigate('Rating', {
                deliveryId: delivery.id,
                targetUserId: delivery.driverId || '',
              })
            }
          >
            <Text style={styles.rateBtnText}>{t('delivery.rateDriver')}</Text>
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
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },

  // ── Summary Card ──
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'left',
    marginStart: 8,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    marginStart: 8,
  },

  // ── Horizontal Timeline ──
  timelineCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  timelineSegment: {
    flex: 1,
    height: 3,
    marginTop: 9,
    borderRadius: 1.5,
  },
  timelineStation: {
    alignItems: 'center',
    width: 52,
  },
  stationDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  truckIcon: {
    fontSize: 14,
    marginTop: 2,
  },
  stationLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },

  // ── Map ──
  mapContainer: {
    height: 290,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapControls: {
    position: 'absolute',
    end: 10,
    top: 10,
    gap: 6,
  },
  mapControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: { elevation: 4 },
    }),
  },
  mapControlIcon: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },

  // ── Driver Card ──
  driverCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  driverTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  driverBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 10,
  },
  driverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  driverBtnSmall: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  driverBtnIcon: {
    fontSize: 18,
  },
  driverBtnLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Media / Images ──
  mediaSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  mediaList: {
    gap: 10,
  },
  mediaThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },

  // ── Payment ──
  paymentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  confirmLabel: {
    fontSize: 14,
  },
  confirmPaymentButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmPaymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Secondary Actions ──
  secondaryActions: {
    gap: 12,
  },
  cancelBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53935',
  },
  rateBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  rateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
