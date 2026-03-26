import React, { useCallback, useState, useEffect, useRef } from 'react';
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
import functions from '@react-native-firebase/functions';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

import { RootStackParamList } from '../../navigation/RootNavigator';
import { formatCurrency } from '../../utils/formatters';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery, Delivery } from '../../hooks/useDelivery';
import { StatusBadge } from '../../components/StatusBadge';
import { AvatarCircle } from '../../components/AvatarCircle';
import { LoadingScreen } from '../../components/LoadingScreen';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { CarAlert, useCarAlert } from '../../components/CarAlert';
import { ImageGalleryModal } from '../../components/ImageGalleryModal';
import { useInAppReview } from '../../hooks/useInAppReview';
import { ProofCamera } from '../../components/ProofCamera';
import { uploadProofPhoto } from '../../services/storage';
import { strings } from '../../i18n/strings';
import { useDriverLocationTracking } from '../../hooks/useDriverLocationTracking';
import { DriverConfirmBanner } from '../../components/DriverConfirmBanner';
import { SenderProfileModal } from '../../components/SenderProfileModal';
import Geolocation from 'react-native-geolocation-service';

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Size emoji map */
const SIZE_ICONS: Record<string, { icon: string; labelKey: 'sizeSmall' | 'sizeMedium' | 'sizeLarge' | 'sizeOther' }> = {
  envelope: { icon: '✉️', labelKey: 'sizeSmall' },
  small: { icon: '✉️', labelKey: 'sizeSmall' },
  medium: { icon: '📦', labelKey: 'sizeMedium' },
  large: { icon: '📦📦', labelKey: 'sizeLarge' },
  xlarge: { icon: '🚚', labelKey: 'sizeOther' },
};

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDeliveryDetail'>;

export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const carAlert = useCarAlert();
  const { currentUser } = useAuth();
  const { expressInterest, withdrawInterest, confirmPayment, confirmSelection, declineSelection, cancelDelivery } = useDelivery({ userId: currentUser?.uid, role: 'driver' });
  const { checkAndPromptReview } = useInAppReview();

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
              item: d.item,
              itemDescription: d.item?.description || d.itemDescription || '',
              itemSize: d.itemSize || d.item?.size,
              photoUrl: d.photoUrl,
              mediaURLs: d.mediaURLs,
              price: d.price || d.suggestedPrice || 0,
              suggestedPrice: d.suggestedPrice || 0,
              scheduledDate: d.scheduledDate,
              pickupDate: d.pickupDate,
              timeRange: d.timeRange,
              notes: d.notes,
              chatId: d.chatId,
              rated: d.rated,
              ratedBySender: d.ratedBySender,
              ratedByDriver: d.ratedByDriver,
              senderRatingGiven: d.senderRatingGiven,
              driverRatingGiven: d.driverRatingGiven,
              payment: d.payment,
              proof: d.proof,
              createdAt: d.createdAt?.toDate?.() || d.createdAt,
              selectedDriverId: d.selectedDriverId || null,
              selectionExpiresAt: d.selectionExpiresAt || null,
              interestedDrivers: d.interestedDrivers || [],
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

  // Track if driver navigated to Rating screen — hide button immediately on return
  const navigatedToRating = useRef(false);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (navigatedToRating.current) {
        setJustRated(true);
        navigatedToRating.current = false;
      }
    });
    return unsub;
  }, [navigation]);

  // Fallback: fetch sender info from users collection if not denormalized on the delivery
  useEffect(() => {
    if (!delivery?.senderId || delivery.senderName) return;
    firestore().collection('users').doc(delivery.senderId).get().then((snap) => {
      if (snap.exists) {
        const u = snap.data()!;
        setDelivery((prev) => prev ? {
          ...prev,
          senderName: u.fullName || '',
          senderPhotoUrl: u.profilePhotoURL || null,
          senderRating: u.ratingAsSender?.average ?? 0,
        } : prev);
      }
    }).catch(() => {});
  }, [delivery?.senderId, delivery?.senderName]);

  // Prompt "Rate us on store" after 1st and 5th completed delivery
  useEffect(() => {
    if (delivery?.status === 'completed_paid' && currentUser?.uid) {
      // Fetch fresh completedDeliveries count from Firestore
      firestore().collection('users').doc(currentUser.uid).get().then((snap) => {
        const count = snap.data()?.completedDeliveries || 0;
        checkAndPromptReview(count);
      }).catch(() => {});
    }
  }, [delivery?.status, currentUser?.uid, checkAndPromptReview]);

  // Continue location tracking while viewing delivery details
  useDriverLocationTracking({
    userId: currentUser?.uid,
    isDriver: true,
    activeDeliveryStatus: delivery?.status,
  });

  const [senderProfileVisible, setSenderProfileVisible] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [proofGalleryVisible, setProofGalleryVisible] = useState(false);
  const [proofGalleryIndex, setProofGalleryIndex] = useState(0);
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [proofType, setProofType] = useState<'pickup' | 'delivery'>('pickup');
  const [proofUploading, setProofUploading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [justRated, setJustRated] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingSteps, setLoadingSteps] = useState<string[]>(['sendingRequest', 'almostDone']);

  const handleProofCapture = useCallback(async (photoUri: string) => {
    setProofModalVisible(false);
    setProofUploading(true);
    setLoadingSteps(['uploadingProof', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
    try {
      const url = await uploadProofPhoto(deliveryId, proofType, photoUri);
      if (proofType === 'pickup') {
        const fn = functions().httpsCallable('confirmPickup');
        await fn({ deliveryId, pickupPhotoURL: url });
      } else {
        const fn = functions().httpsCallable('confirmDelivery');
        await fn({ deliveryId, deliveryPhotoURL: url });
      }
      setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
      carAlert.show(
        'success',
        t('common.success'),
        proofType === 'pickup' ? t('driver.pickupConfirmed') : t('driver.deliveryConfirmed'),
      );
    } catch (err: any) {
      setLoadingVisible(false);
      carAlert.show('error', t('common.error'), err.message || t('driver.statusUpdateError'));
    } finally {
      setProofUploading(false);
    }
  }, [deliveryId, proofType, carAlert, t]);

  const openProofCamera = useCallback((type: 'pickup' | 'delivery') => {
    setProofType(type);
    setProofModalVisible(true);
  }, []);

  const handleWithdrawInterest = (): void => {
    carAlert.show('info', strings.driver.withdrawInterest.he, strings.driver.withdrawConfirm.he, [
      { text: strings.common.cancel.he, style: 'cancel' },
      {
        text: strings.driver.withdrawInterest.he,
        style: 'destructive',
        onPress: async () => {
          setLoadingSteps(['sendingRequest', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
          try {
            await withdrawInterest(deliveryId);
            setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
            carAlert.show('success', t('common.success'), strings.driver.withdrawSuccess.he);
          } catch (err) {
            setLoadingVisible(false);
            carAlert.show('error', t('common.error'), strings.driver.withdrawError.he);
          }
        },
      },
    ]);
  };

  const handleConfirmSelection = async () => {
    try {
      setConfirmLoading(true);
      await confirmSelection(deliveryId);
      carAlert.show('success', 'אושר!', 'המשלוח שויך אליך');
    } catch (err) {
      carAlert.show('error', t('common.error'), (err as Error).message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeclineSelection = async () => {
    try {
      setConfirmLoading(true);
      await declineSelection(deliveryId);
      carAlert.show('info', 'דחית', 'המשלוח הוחזר לשולח');
      navigation.goBack();
    } catch (err) {
      carAlert.show('error', t('common.error'), (err as Error).message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelDelivery = (): void => {
    carAlert.show('info', strings.common.cancel.he, strings.driver.cancelConfirm?.he || 'האם אתה בטוח שברצונך לבטל את האיסוף?', [
      { text: strings.common.cancel.he, style: 'cancel' },
      {
        text: strings.common.confirm.he,
        style: 'destructive',
        onPress: async () => {
          setLoadingSteps(['sendingRequest', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
          try {
            await cancelDelivery(deliveryId);
            setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
            carAlert.show('success', t('common.success'), 'המשלוח בוטל בהצלחה');
            navigation.goBack();
          } catch (err) {
            setLoadingVisible(false);
            carAlert.show('error', t('common.error'), (err as Error).message || 'שגיאה בביטול המשלוח');
          }
        },
      },
    ]);
  };

  const doExpressInterest = async (): Promise<void> => {
    setLoadingSteps(['sendingRequest', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
    try {
      await expressInterest(deliveryId, currentUser!.uid);
      setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
      carAlert.show('success', t('common.success'), t('driver.interestSent'));
    } catch (err) {
      setLoadingVisible(false);
      const msg = (err as Error).message || t('driver.interestError');
      carAlert.show('error', t('common.error'), msg);
    }
  };

  const handleExpressInterest = (): void => {
    if (!delivery?.pickup) {
      doExpressInterest();
      return;
    }
    // Get driver's current location and show distance confirmation
    Geolocation.getCurrentPosition(
      (pos) => {
        const distKm = haversineKm(
          pos.coords.latitude, pos.coords.longitude,
          delivery?.pickup?.lat ?? delivery?.pickup?.latitude ?? 0,
          delivery?.pickup?.lng ?? delivery?.pickup?.longitude ?? 0,
        );
        const distStr = distKm < 1 ? `${Math.round(distKm * 1000)} ${strings.commonExtra.meters.he}` : `${distKm.toFixed(1)} ${strings.commonExtra.km.he}`;
        carAlert.show('info', strings.driver.confirmPickup.he, strings.deliveryExtra.confirmPickupPrompt.he.replace('{dist}', distStr), [
          { text: strings.common.cancel.he, style: 'cancel' },
          { text: strings.driver.confirmPickup.he, onPress: () => doExpressInterest() },
        ]);
      },
      () => {
        // Location unavailable — proceed without distance
        doExpressInterest();
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
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

    carAlert.show('info', t('driver.navigateVia'), t('driver.selectNavApp'), [
      ...navApps.map(app => ({
        text: app.name,
        onPress: () => {
          carAlert.dismiss();
          Linking.openURL(app.url).catch(() => Linking.openURL(fallbackUrl));
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }, [carAlert]);

  if (isLoading || !delivery) {
    return <LoadingScreen />;
  }

  const isMyJob = delivery.driverId === currentUser?.uid;
  const isAvailable = delivery.status === 'new' || delivery.status === 'pending';
  const alreadyInterested = ((delivery as any).interestedDrivers || []).some(
    (d: any) => d.uid === currentUser?.uid && d.status !== 'withdrawn'
  );
  const myInterestStatus = ((delivery as any).interestedDrivers || []).find(
    (d: any) => d.uid === currentUser?.uid
  )?.status;

  const pickupCoords = {
    latitude: delivery.pickup?.latitude || delivery.pickup?.lat || 32.0853,
    longitude: delivery.pickup?.longitude || delivery.pickup?.lng || 34.7818,
  };
  const destCoords = {
    latitude: delivery.destination?.latitude || delivery.destination?.lat || 32.0853,
    longitude: delivery.destination?.longitude || delivery.destination?.lng || 34.7818,
  };
  const sizeInfo = SIZE_ICONS[delivery.itemSize || ''] || SIZE_ICONS.small;

  // Media
  const mediaList: string[] = delivery.mediaURLs?.length
    ? delivery.mediaURLs
    : delivery.photoUrl ? [delivery.photoUrl] : [];
  const isVideoUri = (u: string) => { const l = u.toLowerCase().split('?')[0]; return l.includes('video') || l.endsWith('.mp4') || l.endsWith('.mov'); };
  const imageCount = mediaList.filter(u => !isVideoUri(u)).length;
  const hasVideo = mediaList.some(isVideoUri);

  // Proof photos (pickup, delivery, payment)
  const proofImages: { url: string; label: string }[] = [];
  if (delivery.proof?.pickupURL) proofImages.push({ url: delivery.proof.pickupURL, label: t('deliveryExtra.pickupProof') });
  if (delivery.proof?.deliveryURL) proofImages.push({ url: delivery.proof.deliveryURL, label: t('deliveryExtra.deliveryProof') });
  if (delivery.proof?.paymentURL) proofImages.push({ url: delivery.proof.paymentURL, label: t('deliveryExtra.paymentProof') });
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
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {delivery.itemDescription || strings.commonExtra.deliveryItem.he}
            </Text>
            <View style={[styles.sizeRow, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={styles.sizeIcon}>{sizeInfo.icon}</Text>
              <Text style={[styles.sizeLabel, { color: colors.textSecondary }]}>{t(`form.${sizeInfo.labelKey}`)}</Text>
            </View>
          </View>
          <View style={[styles.priceTag, { backgroundColor: colors.successBg }]}>
            <Text style={[styles.priceValue, { color: colors.success }]}>{formatCurrency(delivery.price ?? delivery.suggestedPrice ?? 0)}</Text>
            {delivery.status === 'completed_paid' && (
              <View style={[styles.earningsBadge, { backgroundColor: colors.success }]}>
                <Text style={styles.earningsBadgeText}>✅ {t('deliveryExtra.addedToEarnings')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {delivery.notes ? (
          <View style={[styles.notesBox, { backgroundColor: colors.warningBg }]}>
            <Text style={styles.notesIcon}>📝</Text>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>{delivery.notes}</Text>
          </View>
        ) : null}
      </View>

      {/* ── 3. Route Card ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

      {/* Driver Confirmation Banner — shown when sender selected this driver */}
      {(delivery as any).selectedDriverId === currentUser?.uid && (delivery as any).selectionExpiresAt && (
        <DriverConfirmBanner
          deliveryId={deliveryId}
          expiresAt={new Date((delivery as any).selectionExpiresAt.seconds * 1000)}
          onConfirm={handleConfirmSelection}
          onDecline={handleDeclineSelection}
          isLoading={confirmLoading}
        />
      )}

      {/* ── Action buttons (above map for visibility) ── */}
      <View style={styles.actions}>
        {isAvailable && !isMyJob && !alreadyInterested && (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={handleExpressInterest}>
            <Text style={styles.actionButtonText}>🚛 {t('driver.expressInterest')}</Text>
          </TouchableOpacity>
        )}

        {isAvailable && !isMyJob && alreadyInterested && myInterestStatus === 'interested' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#E53935' }]}
            onPress={handleWithdrawInterest}
          >
            <Text style={styles.actionButtonText}>{strings.driver.withdrawInterest.he}</Text>
          </TouchableOpacity>
        )}

        {isAvailable && !isMyJob && alreadyInterested && myInterestStatus !== 'interested' && (
          <View style={[styles.actionButton, { backgroundColor: '#9E9E9E' }]}>
            <Text style={styles.actionButtonText}>אישור איסוף ✓</Text>
          </View>
        )}

        {/* Withdraw interest — driver cancels after expressing interest (pending status) */}
        {isMyJob && delivery.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#E53935' }]}
            onPress={handleWithdrawInterest}
          >
            <Text style={styles.actionButtonText}>{strings.driver.withdrawInterest.he}</Text>
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'waiting_for_pickup' && (
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

        {/* Cancel delivery — driver can cancel before pickup (waiting/matched only, pending uses withdraw) */}
        {isMyJob && ['awaiting_confirm', 'waiting_for_pickup'].includes(delivery.status) && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#E53935' }]}
            onPress={handleCancelDelivery}
          >
            <Text style={styles.actionButtonText}>❌ ביטול משלוח</Text>
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'picked_up' && (
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
            style={[styles.chatButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
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
          onPress={() => openNavigation(pickupCoords.latitude, pickupCoords.longitude, delivery.pickup?.address || t('delivery.pickup'))}
        >
          <Text style={styles.navBtnIcon}>📍</Text>
          <Text style={styles.navBtnText}>{t('driver.navigateToPickup')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: colors.primary }]}
          onPress={() => openNavigation(destCoords.latitude, destCoords.longitude, delivery.destination?.address || t('delivery.destination'))}
        >
          <Text style={styles.navBtnIcon}>🏁</Text>
          <Text style={styles.navBtnText}>{t('driver.navigateToDestination')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── 5. Sender Card ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.senderRow} activeOpacity={0.7} onPress={() => setSenderProfileVisible(true)}>
          <AvatarCircle name={delivery.senderName || ''} photoUrl={delivery.senderPhotoUrl} size={44} />
          <View style={styles.senderInfo}>
            <Text style={[styles.senderName, { color: colors.textPrimary }]}>{delivery.senderName}</Text>
            <Text style={[styles.senderRating, { color: colors.textSecondary }]}>
              {delivery.senderRating ? `⭐ ${delivery.senderRating.toFixed(1)}` : t('driver.newSender')}
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
        </TouchableOpacity>
      </View>

      {/* ── 6. Item Images Gallery ── */}
      {mediaList.length > 0 && (
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            {t('deliveryExtra.itemPhotos')} ({imageCount}/5{hasVideo ? ` + ${t('deliveryExtra.video')}` : ''})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaList}>
            {mediaList.map((url, i) => {
              const isVideo = isVideoUri(url);
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
                    <View style={[styles.mediaThumb, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 28 }}>🎬</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>{t('deliveryExtra.video')}</Text>
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
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.proofTitle, { color: colors.textPrimary }]}>{`📸 ${strings.deliveryExtra.deliveryProofs.he}`}</Text>
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
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: colors.success, borderStartWidth: 3 }]}>
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
              <Text style={[styles.paymentProofLabel, { color: colors.success }]}>{t('deliveryExtra.paymentProofFromSender')}</Text>
            </TouchableOpacity>
          )}

          {!delivery.payment?.driverConfirmed && (
            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: delivery.payment?.senderConfirmed ? colors.success : '#9E9E9E',
                marginTop: 12,
              }]}
              disabled={!delivery.payment?.senderConfirmed}
              onPress={async () => {
                setLoadingSteps(['confirmingPayment', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
                try {
                  await confirmPayment(delivery.id);
                  setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
                  carAlert.show('success', t('payment.successTitle'), t('payment.driverConfirmedMsg'));
                } catch (e: any) {
                  setLoadingVisible(false);
                  carAlert.show('error', t('common.error'), e.message);
                }
              }}
            >
              <Text style={styles.actionButtonText}>
                {delivery.payment?.senderConfirmed
                  ? `💰 ${t('payment.confirmButton')}`
                  : `⏳ ${t('payment.waitingForSender')}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── 7b. Awaiting payment — driver confirms receipt ── */}
      {isMyJob && delivery.status === 'awaiting_payment' && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderStartColor: colors.success, borderStartWidth: 3 }]}>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>💳 ממתין לתשלום</Text>
          {delivery.payment?.driverConfirmed ? (
            <View style={{ backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginTop: 8 }}>
              <Text style={{ color: '#2E7D32', fontWeight: '600', textAlign: 'right' }}>
                ✅ אישרת תשלום — ממתין לאישור השולח
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success }]}
              onPress={async () => {
                setLoadingSteps(['confirmingPayment', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
                try {
                  await confirmPayment(delivery.id);
                  setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
                  carAlert.show('success', t('payment.successTitle'), t('payment.driverConfirmedMsg'));
                } catch (e: any) {
                  setLoadingVisible(false);
                  carAlert.show('error', t('common.error'), e.message);
                }
              }}
              disabled={confirmLoading}
            >
              {confirmLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>💰 אשר קבלת תשלום</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── 8. Rate sender ── */}
      {['delivered', 'awaiting_payment', 'completed_paid'].includes(delivery.status) && !delivery.ratedByDriver && !justRated && (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.accent, alignItems: 'center', paddingVertical: 16 }]}
          onPress={() => {
            navigatedToRating.current = true;
            navigation.navigate('Rating', { deliveryId: delivery.id, targetUserId: delivery.senderId });
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{t('delivery.rateSender')}</Text>
        </TouchableOpacity>
      )}

      {/* ── 9. Ratings summary — visible when both parties rated ── */}
      {delivery.ratedBySender && delivery.ratedByDriver && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>⭐ דירוגים</Text>

          {/* Driver's rating (about sender) */}
          {delivery.driverRatingGiven && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>
                הדירוג שלך על השולח
              </Text>
              <Text style={styles.ratingStarsGold}>
                {'★'.repeat(delivery.driverRatingGiven.rating)}
                {'☆'.repeat(5 - delivery.driverRatingGiven.rating)}
              </Text>
              {delivery.driverRatingGiven.comment ? (
                <Text style={[styles.ratingComment, { color: colors.textPrimary }]} numberOfLines={3}>
                  &quot;{delivery.driverRatingGiven.comment}&quot;
                </Text>
              ) : null}
            </View>
          )}

          {/* Sender's rating (about driver) */}
          {delivery.senderRatingGiven && (
            <View>
              <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>
                דירוג השולח עליך
              </Text>
              <Text style={styles.ratingStarsGold}>
                {'★'.repeat(delivery.senderRatingGiven.rating)}
                {'☆'.repeat(5 - delivery.senderRatingGiven.rating)}
              </Text>
              {delivery.senderRatingGiven.comment ? (
                <Text style={[styles.ratingComment, { color: colors.textPrimary }]} numberOfLines={3}>
                  &quot;{delivery.senderRatingGiven.comment}&quot;
                </Text>
              ) : null}
            </View>
          )}
        </View>
      )}

    </ScrollView>

    {/* Modals */}
    <ProofCamera
      visible={proofModalVisible}
      onCapture={handleProofCapture}
      onClose={() => setProofModalVisible(false)}
      label={proofType === 'pickup' ? t('driver.capturePickupProof') : t('driver.captureDeliveryProof')}
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
    <LoadingOverlay
      visible={loadingVisible}
      steps={loadingSteps}
      currentStep={loadingStep}
      timeout={60000}
      onTimeout={() => setLoadingVisible(false)}
      onCancel={() => setLoadingVisible(false)}
    />
    <SenderProfileModal
      visible={senderProfileVisible}
      onClose={() => setSenderProfileVisible(false)}
      senderUid={delivery.senderId}
      senderName={delivery.senderName || ''}
      senderPhotoUrl={delivery.senderPhotoUrl || null}
      senderRating={delivery.senderRating ?? 0}
      senderCompletedDeliveries={0}
    />
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
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  ratingStarsGold: {
    fontSize: 18,
    color: '#FFB800',
    letterSpacing: 2,
  },
  ratingComment: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
    writingDirection: 'rtl',
  },
});
