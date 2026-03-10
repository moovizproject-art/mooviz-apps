import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery, Delivery } from '../../hooks/useDelivery';
import { StatusBadge } from '../../components/StatusBadge';
import { AvatarCircle } from '../../components/AvatarCircle';
import { LoadingScreen } from '../../components/LoadingScreen';
import { CarAlert, useCarAlert } from '../../components/CarAlert';
import { ImageGalleryModal } from '../../components/ImageGalleryModal';
import { ProofCamera } from '../../components/ProofCamera';
import { uploadProofPhoto } from '../../services/storage';

/** Size emoji map */
const SIZE_ICONS: Record<string, { icon: string; label: string }> = {
  envelope: { icon: '✉️', label: 'מעטפה' },
  small: { icon: '📦', label: 'קטן' },
  medium: { icon: '📦', label: 'בינוני' },
  large: { icon: '📦📦', label: 'גדול' },
  xlarge: { icon: '🏗️', label: 'חריג' },
};

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDeliveryDetail'>;

export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const carAlert = useCarAlert();
  const { currentUser } = useAuth();
  const { expressInterest, confirmPayment } = useDelivery({ userId: currentUser?.uid, role: 'driver' });

  // Direct document listener — works for ANY delivery regardless of driverId
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .onSnapshot(
        (snap) => {
          if (snap.exists) {
            const d = snap.data()!;
            setDelivery({
              id: snap.id,
              senderId: d.senderId,
              senderName: d.senderName,
              senderPhotoUrl: d.senderPhotoUrl,
              senderRating: d.senderRating,
              driverId: d.driverId,
              driverName: d.driverName,
              driverPhotoUrl: d.driverPhotoUrl,
              driverRating: d.driverRating,
              status: d.status,
              pickup: d.pickup,
              destination: d.destination,
              itemDescription: d.itemDescription || '',
              itemSize: d.itemSize,
              photoUrl: d.photoUrl,
              mediaURLs: d.mediaURLs,
              suggestedPrice: d.suggestedPrice || 0,
              scheduledDate: d.scheduledDate,
              notes: d.notes,
              chatId: d.chatId,
              rated: d.rated,
              payment: d.payment,
              proof: d.proof,
              createdAt: d.createdAt?.toDate?.() || d.createdAt,
            });
          }
          setIsLoading(false);
        },
        (err) => {
          console.warn('[DriverDeliveryDetail] Snapshot error:', err.message);
          setIsLoading(false);
        },
      );
    return unsub;
  }, [deliveryId]);

  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [proofGalleryVisible, setProofGalleryVisible] = useState(false);
  const [proofGalleryIndex, setProofGalleryIndex] = useState(0);
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [proofType, setProofType] = useState<'pickup' | 'delivery'>('pickup');
  const [proofUploading, setProofUploading] = useState(false);

  const handleProofCapture = useCallback(async (photoUri: string) => {
    setProofModalVisible(false);
    setProofUploading(true);
    try {
      const url = await uploadProofPhoto(deliveryId, proofType, photoUri);
      const newStatus = proofType === 'pickup' ? 'picked_up' : 'delivered';
      const proofField = proofType === 'pickup' ? 'proof.pickupURL' : 'proof.deliveryURL';
      await firestore().collection('deliveries').doc(deliveryId).update({
        status: newStatus,
        [proofField]: url,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      carAlert.show(
        'success',
        t('common.success'),
        proofType === 'pickup' ? t('driver.pickupConfirmed') : t('driver.deliveryConfirmed'),
      );
    } catch (err: any) {
      carAlert.show('error', t('common.error'), err.message || t('driver.statusUpdateError'));
    } finally {
      setProofUploading(false);
    }
  }, [deliveryId, proofType, carAlert, t]);

  const openProofCamera = useCallback((type: 'pickup' | 'delivery') => {
    setProofType(type);
    setProofModalVisible(true);
  }, []);

  const handleExpressInterest = async (): Promise<void> => {
    try {
      await expressInterest(deliveryId, currentUser!.uid);
      carAlert.show('success', t('common.success'), t('driver.interestSent'));
    } catch (err) {
      carAlert.show('error', t('common.error'), t('driver.interestError'));
    }
  };

  const openNavigation = useCallback((lat: number, lng: number, label: string) => {
    const encodedLabel = encodeURIComponent(label);
    const fallbackUrl = Platform.OS === 'ios'
      ? `maps:?daddr=${lat},${lng}&dirflg=d`
      : `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;

    const navApps = [
      { name: '🗺️ Waze', url: `waze://?ll=${lat},${lng}&navigate=yes` },
      {
        name: '📍 Google Maps',
        url: Platform.OS === 'ios'
          ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
          : `google.navigation:q=${lat},${lng}`,
      },
      { name: Platform.OS === 'ios' ? '🍎 Apple Maps' : '🗺️ Maps', url: fallbackUrl },
    ];

    carAlert.show('info', 'נווט באמצעות', 'בחר אפליקציית ניווט', [
      ...navApps.map(app => ({
        text: app.name,
        onPress: () => {
          carAlert.dismiss();
          Linking.openURL(app.url).catch(() => Linking.openURL(fallbackUrl));
        },
      })),
      { text: 'ביטול', style: 'cancel' as const },
    ]);
  }, [carAlert]);

  if (isLoading || !delivery) {
    return <LoadingScreen />;
  }

  const isMyJob = delivery.driverId === currentUser?.uid;
  const isAvailable = delivery.status === 'new' || delivery.status === 'pending';

  const pickupCoords = {
    latitude: delivery.pickup?.latitude || delivery.pickup?.lat || 32.0853,
    longitude: delivery.pickup?.longitude || delivery.pickup?.lng || 34.7818,
  };
  const destCoords = {
    latitude: delivery.destination?.latitude || delivery.destination?.lat || 32.0853,
    longitude: delivery.destination?.longitude || delivery.destination?.lng || 34.7818,
  };
  const sizeInfo = SIZE_ICONS[delivery.itemSize || ''] || SIZE_ICONS.medium;

  // Media
  const mediaList: string[] = delivery.mediaURLs?.length
    ? delivery.mediaURLs
    : delivery.photoUrl ? [delivery.photoUrl] : [];
  const imageCount = mediaList.filter(u => !u.toLowerCase().includes('video') && !u.toLowerCase().endsWith('.mp4')).length;
  const hasVideo = mediaList.some(u => u.toLowerCase().includes('video') || u.toLowerCase().endsWith('.mp4'));

  // Proof photos (pickup, delivery, payment)
  const proofImages: { url: string; label: string }[] = [];
  if (delivery.proof?.pickupURL) proofImages.push({ url: delivery.proof.pickupURL, label: 'הוכחת איסוף' });
  if (delivery.proof?.deliveryURL) proofImages.push({ url: delivery.proof.deliveryURL, label: 'הוכחת מסירה' });
  if (delivery.proof?.paymentURL) proofImages.push({ url: delivery.proof.paymentURL, label: 'צילום תשלום' });
  const proofUrls = proofImages.map(p => p.url);

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── 1. Status + ID header ── */}
      <View style={styles.statusRow}>
        <StatusBadge status={delivery.status} />
        <Text style={[styles.deliveryId, { color: colors.textSecondary }]}>#{deliveryId.slice(0, 8)}</Text>
      </View>

      {/* ── 2. Item Summary Card ── */}
      <View style={[styles.card, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {delivery.itemDescription || 'משלוח'}
            </Text>
            <View style={styles.sizeRow}>
              <Text style={styles.sizeIcon}>{sizeInfo.icon}</Text>
              <Text style={[styles.sizeLabel, { color: colors.textSecondary }]}>{sizeInfo.label}</Text>
            </View>
          </View>
          <View style={[styles.priceTag, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.priceValue}>₪{delivery.suggestedPrice || 0}</Text>
            {delivery.status === 'completed_paid' && (
              <View style={styles.earningsBadge}>
                <Text style={styles.earningsBadgeText}>✅ נוסף לרווחים</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {delivery.notes ? (
          <View style={[styles.notesBox, { backgroundColor: '#FFF8E1' }]}>
            <Text style={styles.notesIcon}>📝</Text>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>{delivery.notes}</Text>
          </View>
        ) : null}
      </View>

      {/* ── 3. Route Card ── */}
      <View style={[styles.card, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
          <View style={styles.routeInfo}>
            <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>{t('delivery.pickup')}</Text>
            <Text style={[styles.routeAddress, { color: colors.textPrimary }]}>{delivery.pickup?.address || '—'}</Text>
          </View>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
          <View style={styles.routeInfo}>
            <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>{t('delivery.destination')}</Text>
            <Text style={[styles.routeAddress, { color: colors.textPrimary }]}>{delivery.destination?.address || '—'}</Text>
          </View>
        </View>
      </View>

      {/* ── Action buttons (above map for visibility) ── */}
      <View style={styles.actions}>
        {isAvailable && !isMyJob && (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={handleExpressInterest}>
            <Text style={styles.actionButtonText}>🚛 {t('driver.expressInterest')}</Text>
          </TouchableOpacity>
        )}

        {isMyJob && (delivery.status === 'matched' || delivery.status === 'waiting') && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => openProofCamera('pickup')}
            disabled={proofUploading}
          >
            {proofUploading && proofType === 'pickup' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>📸 {t('driver.confirmPickup')}</Text>
            )}
          </TouchableOpacity>
        )}

        {isMyJob && (delivery.status === 'picked_up' || delivery.status === 'in_transit') && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={() => openProofCamera('delivery')}
            disabled={proofUploading}
          >
            {proofUploading && proofType === 'delivery' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>📸 {t('driver.confirmDelivery')}</Text>
            )}
          </TouchableOpacity>
        )}

        {isMyJob && !!delivery.chatId && (
          <TouchableOpacity
            style={[styles.chatButton, { borderColor: colors.primary }]}
            onPress={() => navigation.navigate('ChatRoom', { chatId: delivery.chatId!, recipientName: delivery.senderName || '' })}
          >
            <Text style={[styles.chatButtonText, { color: colors.primary }]}>💬 {t('driver.chatWithSender')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── 4. Map ── */}
      <View style={styles.mapContainer}>
        <MapView
          provider={MAP_PROVIDER}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: (pickupCoords.latitude + destCoords.latitude) / 2,
            longitude: (pickupCoords.longitude + destCoords.longitude) / 2,
            latitudeDelta: Math.abs(pickupCoords.latitude - destCoords.latitude) * 1.8 + 0.01,
            longitudeDelta: Math.abs(pickupCoords.longitude - destCoords.longitude) * 1.8 + 0.01,
          }}
          showsUserLocation={isMyJob}
          showsMyLocationButton={isMyJob}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <Marker coordinate={pickupCoords} pinColor="green" title={delivery.pickup?.address} />
          <Marker coordinate={destCoords} pinColor="red" title={delivery.destination?.address} />
        </MapView>
      </View>

      {/* Navigate buttons */}
      <View style={styles.navButtons}>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: colors.success }]}
          onPress={() => openNavigation(pickupCoords.latitude, pickupCoords.longitude, delivery.pickup?.address || 'Pickup')}
        >
          <Text style={styles.navBtnIcon}>📍</Text>
          <Text style={styles.navBtnText}>נווט לאיסוף</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: colors.primary }]}
          onPress={() => openNavigation(destCoords.latitude, destCoords.longitude, delivery.destination?.address || 'Destination')}
        >
          <Text style={styles.navBtnIcon}>🏁</Text>
          <Text style={styles.navBtnText}>נווט ליעד</Text>
        </TouchableOpacity>
      </View>

      {/* ── 5. Sender Card ── */}
      <View style={[styles.card, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.senderRow}>
          <AvatarCircle name={delivery.senderName || ''} photoUrl={delivery.senderPhotoUrl} size={44} />
          <View style={styles.senderInfo}>
            <Text style={[styles.senderName, { color: colors.textPrimary }]}>{delivery.senderName}</Text>
            <Text style={[styles.senderRating, { color: colors.textSecondary }]}>
              {delivery.senderRating ? `⭐ ${delivery.senderRating.toFixed(1)}` : 'שולח חדש'}
            </Text>
          </View>
          {isMyJob && !!delivery.chatId && (
            <TouchableOpacity
              style={[styles.chatMiniBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('ChatRoom', { chatId: delivery.chatId!, recipientName: delivery.senderName || '' })}
            >
              <Text style={styles.chatMiniBtnText}>💬</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 6. Item Images Gallery ── */}
      {mediaList.length > 0 && (
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            תמונות הפריט ({imageCount}/5{hasVideo ? ' + וידאו' : ''})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaList}>
            {mediaList.map((url, i) => {
              const isVideo = url.toLowerCase().includes('video') || url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.mov');
              return (
                <TouchableOpacity
                  key={`${i}-${url}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (isVideo) {
                      Linking.openURL(url).catch(() => {});
                    } else {
                      setGalleryIndex(i);
                      setGalleryVisible(true);
                    }
                  }}
                >
                  {isVideo ? (
                    <View style={[styles.mediaThumb, { backgroundColor: '#1a237e', justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 28 }}>🎬</Text>
                      <Text style={{ color: '#fff', fontSize: 10, marginTop: 4 }}>וידאו</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: url }} style={styles.mediaThumb} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── 6b. Proof Photos ── */}
      {proofImages.length > 0 && (
        <View style={[styles.card, { backgroundColor: '#FFFFFF' }]}>
          <Text style={[styles.proofTitle, { color: colors.textPrimary }]}>📸 הוכחות משלוח</Text>
          <View style={styles.proofRow}>
            {proofImages.map((proof, i) => (
              <TouchableOpacity
                key={proof.url}
                style={styles.proofItem}
                activeOpacity={0.8}
                onPress={() => { setProofGalleryIndex(i); setProofGalleryVisible(true); }}
              >
                <Image source={{ uri: proof.url }} style={styles.proofThumb} />
                <Text style={[styles.proofLabel, { color: colors.textSecondary }]}>{proof.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── 7. Payment confirmation ── */}
      {(delivery.status === 'delivered' || delivery.status === 'completed_paid') && (
        <View style={[styles.card, { backgroundColor: '#FFFFFF', borderStartColor: '#4CAF50', borderStartWidth: 3 }]}>
          <Text style={[styles.paymentTitle, { color: colors.textPrimary }]}>{t('payment.confirmTitle')}</Text>

          <View style={styles.confirmRow}>
            <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('payment.senderStatus')}</Text>
            <Text style={{ color: delivery.payment?.senderConfirmed ? colors.success : colors.textSecondary, fontWeight: '600' }}>
              {delivery.payment?.senderConfirmed ? '✅ ' + t('payment.confirmed') : '⏳ ' + t('payment.pending')}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('payment.driverStatus')}</Text>
            <Text style={{ color: delivery.payment?.driverConfirmed ? colors.success : colors.textSecondary, fontWeight: '600' }}>
              {delivery.payment?.driverConfirmed ? '✅ ' + t('payment.confirmed') : '⏳ ' + t('payment.pending')}
            </Text>
          </View>

          {delivery.proof?.paymentURL && (
            <TouchableOpacity
              style={styles.paymentProofRow}
              onPress={() => {
                const idx = proofUrls.indexOf(delivery.proof!.paymentURL!);
                setProofGalleryIndex(idx >= 0 ? idx : 0);
                setProofGalleryVisible(true);
              }}
            >
              <Image source={{ uri: delivery.proof.paymentURL }} style={styles.paymentProofThumb} />
              <Text style={[styles.paymentProofLabel, { color: colors.success }]}>צילום תשלום מהשולח</Text>
            </TouchableOpacity>
          )}

          {!delivery.payment?.driverConfirmed && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success, marginTop: 12 }]}
              onPress={async () => {
                try {
                  await confirmPayment(delivery.id);
                  carAlert.show('success', t('payment.successTitle'), t('payment.driverConfirmedMsg'));
                } catch (e: any) {
                  carAlert.show('error', t('common.error'), e.message);
                }
              }}
            >
              <Text style={styles.actionButtonText}>💰 {t('payment.confirmButton')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

    </ScrollView>

    {/* Modals */}
    <ProofCamera
      visible={proofModalVisible}
      onCapture={handleProofCapture}
      onClose={() => setProofModalVisible(false)}
      label={proofType === 'pickup' ? 'צלם הוכחת איסוף' : 'צלם הוכחת מסירה'}
    />
    <ImageGalleryModal
      visible={galleryVisible}
      images={mediaList}
      initialIndex={galleryIndex}
      onClose={() => setGalleryVisible(false)}
    />
    <ImageGalleryModal
      visible={proofGalleryVisible}
      images={proofUrls}
      initialIndex={proofGalleryIndex}
      onClose={() => setProofGalleryVisible(false)}
    />
    <CarAlert visible={carAlert.visible} type={carAlert.type} title={carAlert.title} message={carAlert.message} buttons={carAlert.buttons} onDismiss={carAlert.dismiss} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deliveryId: {
    fontSize: 12,
    fontFamily: 'monospace',
  },

  // ── White 3D Cards ──
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },

  // ── Item Summary ──
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  sizeIcon: {
    fontSize: 16,
  },
  sizeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2E7D32',
  },
  earningsBadge: {
    marginTop: 4,
    backgroundColor: '#2E7D32',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  earningsBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  notesBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  notesIcon: {
    fontSize: 14,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Route ──
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginEnd: 10,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  routeAddress: {
    fontSize: 14,
    marginTop: 1,
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginStart: 4,
    marginVertical: 3,
  },

  // ── Map ──
  mapContainer: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  navBtnIcon: {
    fontSize: 16,
  },
  navBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Sender ──
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '700',
  },
  senderRating: {
    fontSize: 13,
    marginTop: 2,
  },
  chatMiniBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMiniBtnText: {
    fontSize: 20,
  },

  // ── Media Gallery ──
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  mediaList: {
    gap: 8,
  },
  mediaThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    color: '#fff',
    fontSize: 24,
  },

  // ── Proof Photos ──
  proofTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  proofRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  proofItem: {
    alignItems: 'center',
    gap: 4,
  },
  proofThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  proofLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Payment ──
  paymentProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  paymentProofThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  paymentProofLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  confirmLabel: {
    fontSize: 14,
  },

  // ── Actions ──
  actions: {
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  chatButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
