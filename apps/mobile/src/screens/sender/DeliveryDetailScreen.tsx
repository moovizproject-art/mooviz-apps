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
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { uploadDeliveryMedia } from '../../services/storage';
import { ImageGalleryModal } from '../../components/ImageGalleryModal';
import { AppAlert } from '../../components/AppAlert';
import { CarAlert, useCarAlert } from '../../components/CarAlert';
import { uploadPaymentProof } from '../../services/storage';

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
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { DriverApprovalCard } from '../../components/DriverApprovalCard';
import { InterestedDriversList } from '../../components/InterestedDriversList';
import { ReportModal } from '../../components/ReportModal';
import { DriverProfileModal } from '../../components/DriverProfileModal';

type Props = NativeStackScreenProps<RootStackParamList, 'SenderDeliveryDetail'>;

/** Get 4 visible timeline steps based on current status (sliding window) */
function getTimelineSteps(
  currentStatus: string,
  t: (key: string) => string,
): Array<{ key: string; label: string; completed: boolean; active: boolean }> {
  const FULL_ORDER = ['new', 'pending', 'awaiting_confirm', 'waiting_for_pickup', 'picked_up', 'delivered', 'awaiting_payment', 'completed_paid'];
  const currentIndex = FULL_ORDER.indexOf(currentStatus);

  type Step = { key: string; label: string; statuses: string[] };
  let steps: Step[];

  if (currentIndex <= 1) {
    // Early phase: new, pending
    steps = [
      { key: 'start', label: currentStatus === 'pending' ? t('delivery.timelinePending') : t('delivery.timelineNew'), statuses: ['new', 'pending'] },
      { key: 'confirm', label: t('delivery.timelineWaiting'), statuses: ['awaiting_confirm', 'waiting_for_pickup'] },
      { key: 'transit', label: t('delivery.timelinePickedUp'), statuses: ['picked_up'] },
      { key: 'deliver', label: t('delivery.timelineDelivered'), statuses: ['delivered'] },
    ];
  } else if (currentIndex <= 3) {
    // Confirm/pickup phase
    steps = [
      { key: 'confirm', label: currentStatus === 'awaiting_confirm' ? t('status.awaitingConfirm') : t('delivery.timelineWaiting'), statuses: ['awaiting_confirm', 'waiting_for_pickup'] },
      { key: 'transit', label: t('delivery.timelinePickedUp'), statuses: ['picked_up'] },
      { key: 'deliver', label: t('delivery.timelineDelivered'), statuses: ['delivered'] },
      { key: 'payment', label: t('delivery.timelinePayment'), statuses: ['awaiting_payment', 'completed_paid'] },
    ];
  } else if (currentIndex <= 5) {
    // Transit/delivery phase
    steps = [
      { key: 'transit', label: t('delivery.timelinePickedUp'), statuses: ['picked_up'] },
      { key: 'deliver', label: t('delivery.timelineDelivered'), statuses: ['delivered'] },
      { key: 'payment', label: t('delivery.timelineAwaitingPayment'), statuses: ['awaiting_payment'] },
      { key: 'done', label: t('delivery.timelineCompleted'), statuses: ['completed_paid'] },
    ];
  } else {
    // Payment/completion phase
    steps = [
      { key: 'deliver', label: t('delivery.timelineDelivered'), statuses: ['delivered'] },
      { key: 'payment', label: t('delivery.timelineAwaitingPayment'), statuses: ['awaiting_payment'] },
      { key: 'done', label: t('delivery.timelineCompleted'), statuses: ['completed_paid'] },
      { key: 'final', label: '✅', statuses: ['completed_paid'] },
    ];
  }

  // At completed_paid all steps are done — mark everything completed so dots render green not blue
  const allDone = currentStatus === 'completed_paid';

  return steps.map((step) => {
    const stepMaxIndex = Math.max(...step.statuses.map(s => FULL_ORDER.indexOf(s)));
    const stepMinIndex = Math.min(...step.statuses.map(s => FULL_ORDER.indexOf(s)));
    const completed = allDone || currentIndex > stepMaxIndex;
    const active = !completed && currentIndex >= stepMinIndex && currentIndex <= stepMaxIndex;
    return { key: step.key, label: step.label, completed, active };
  });
}

/**
 * DeliveryDetailScreen (Sender) — מסך פרטי משלוח לשולח
 * Scrollable: summary → timeline → map → driver card → images → payment → actions
 */
export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { getDeliveryById, isLoading, confirmPayment, selectDriver, cancelSelectedDriver, cancelDelivery, deleteDelivery } = useDelivery({ userId: currentUser?.uid, role: 'sender' });
  const delivery = getDeliveryById(deliveryId);

  const [driverProfile, setDriverProfile] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const paymentSectionY = useRef<number>(0);
  const hasAutoScrolled = useRef(false);
  const staticMapRef = useRef<MapView>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [cancelAlertVisible, setCancelAlertVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const carAlert = useCarAlert();
  const [proofGalleryVisible, setProofGalleryVisible] = useState(false);
  const [proofGalleryIndex, setProofGalleryIndex] = useState(0);
  const [paymentUploading, setPaymentUploading] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingSteps, setLoadingSteps] = useState<string[]>(['sendingRequest', 'almostDone']);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileDriverUid, setProfileDriverUid] = useState<string | null>(null);
  const [justRated, setJustRated] = useState(false);
  const navigatedToRating = useRef(false);

  // Hide rate button immediately when returning from Rating screen
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (navigatedToRating.current) {
        setJustRated(true);
        navigatedToRating.current = false;
      }
    });
    return unsub;
  }, [navigation]);

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

  const handleSelectDriver = async (driverUid: string) => {
    try {
      setLoadingVisible(true);
      await selectDriver(delivery!.id, driverUid);
      setProfileModalVisible(false);
      carAlert.show('success', t('common.success'), t('delivery.driverSelectedMessage'));
    } catch (err) {
      carAlert.show('error', t('common.error'), (err as Error).message);
    } finally {
      setLoadingVisible(false);
    }
  };

  const handleViewProfile = (driverUid: string) => {
    setProfileDriverUid(driverUid);
    setProfileModalVisible(true);
  };

  const handleCancelSelection = async () => {
    try {
      await cancelSelectedDriver(delivery!.id);
    } catch (err) {
      carAlert.show('error', t('common.error'), (err as Error).message);
    }
  };

  const timelineSteps = useMemo(() => getTimelineSteps(delivery?.status || 'new', t), [delivery?.status, t]);

  // Media: combine mediaURLs + single photoUrl (computed before hooks that depend on it)
  const mediaList: string[] = delivery?.mediaURLs?.length
    ? delivery.mediaURLs
    : delivery?.photoUrl ? [delivery.photoUrl] : [];

  const isVideoUri = (u: string) => { const l = u.toLowerCase().split('?')[0]; return l.includes('video') || l.endsWith('.mp4') || l.endsWith('.mov'); };
  const imageCount = mediaList.filter(u => !isVideoUri(u)).length;
  const hasVideo = mediaList.some(isVideoUri);

  const handleAddMedia = useCallback(async (type: 'photo' | 'video') => {
    if (!delivery) return;
    const maxNew = type === 'photo' ? 5 - imageCount : 1;
    if (maxNew <= 0) return;
    try {
      const result = await launchImageLibrary({
        mediaType: type,
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        selectionLimit: type === 'photo' ? maxNew : 1,
      });
      if (result.didCancel || !result.assets?.length) return;

      setMediaUploading(true);
      const uris = result.assets.map(a => a.uri!).filter(Boolean);
      const newUrls = await uploadDeliveryMedia(delivery.senderId || delivery.id, uris);
      const updatedMedia = [...mediaList, ...newUrls];

      await firestore().collection('deliveries').doc(delivery.id).update({
        mediaURLs: updatedMedia,
        photoUrl: updatedMedia[0] || null,
      });
      setMediaUploading(false);
    } catch (err: any) {
      setMediaUploading(false);
      Alert.alert(t('common.error'), err.message || t('errors.uploadFailed'));
    }
  }, [delivery?.id, delivery?.senderId, mediaList, imageCount]);

  const handleDeleteMedia = useCallback((_url: string, index: number) => {
    if (!delivery) return;
    Alert.alert(
      t('deliveryExtra.deletePhoto'),
      t('deliveryExtra.deletePhotoConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('deliveryExtra.deleteAction'),
          style: 'destructive',
          onPress: async () => {
            const updated = mediaList.filter((_, i) => i !== index);
            await firestore().collection('deliveries').doc(delivery.id).update({
              mediaURLs: updated,
              photoUrl: updated[0] || null,
            });
          },
        },
      ],
    );
  }, [delivery?.id, mediaList]);

  // Auto-scroll to payment section when delivery is picked_up/delivered (first access)
  useEffect(() => {
    if (!delivery || hasAutoScrolled.current) return;
    const shouldScroll = ['picked_up', 'delivered'].includes(delivery.status);
    if (shouldScroll && paymentSectionY.current > 0) {
      hasAutoScrolled.current = true;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: paymentSectionY.current - 80, animated: true });
      }, 500);
    }
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

  const showLiveMap = ['awaiting_confirm', 'waiting_for_pickup', 'picked_up', 'delivered'].includes(delivery.status) && delivery.driverId;

  // Find when delivery was marked as 'delivered' for car hide timer
  const deliveredAt = (delivery as any)?.statusHistory?.delivered ?? null;
  // Cancel allowed only pre-pickup statuses
  const canCancel = ['new', 'pending', 'awaiting_confirm', 'waiting_for_pickup'].includes(delivery.status);
  const isPostPickup = ['picked_up', 'delivered', 'awaiting_payment', 'completed_paid'].includes(delivery.status);
  const showPayment = ['delivered', 'awaiting_payment', 'completed_paid'].includes(delivery.status);
  const showRate = ['delivered', 'awaiting_payment', 'completed_paid'].includes(delivery.status) && !delivery.ratedBySender && !justRated;
  const hasDriver = !!delivery.driverId;
  const driverName = driverProfile?.fullName || delivery.driverName || '';
  const driverPhoto = driverProfile?.profilePhotoURL || delivery.driverPhotoUrl;
  const driverRating = driverProfile?.ratingAsDriver?.average || delivery.driverRating;
  const driverPhone = driverProfile?.phone;
  const completedTrips = driverProfile?.completedDeliveries;

  const canEditOrDelete = delivery.status === 'new'
    && delivery.senderId === currentUser?.uid
    && (delivery.interestedDrivers?.filter((d: any) => d.status !== 'withdrawn')?.length ?? 0) === 0;

  const canEditMedia = ['new', 'pending'].includes(delivery.status) && delivery.senderId === currentUser?.uid;
  const canAddImage = canEditMedia && imageCount < 5;
  const canAddVideo = canEditMedia && !hasVideo;

  const handleCall = () => {
    if (!driverPhone) return;
    const url = Platform.OS === 'ios' ? `telprompt:${driverPhone}` : `tel:${driverPhone}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleChat = async () => {
    let chatIdToUse = delivery.chatId;

    // If chatId missing but driver assigned, create chat on-the-fly
    if (!chatIdToUse && delivery.driverId && currentUser?.uid) {
      try {
        const chatRef = firestore().collection('chats').doc();
        await chatRef.set({
          deliveryId: delivery.id,
          participants: [currentUser.uid, delivery.driverId],
          senderName: currentUser.fullName || '',
          driverName: driverName || '',
          lastMessage: '',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        // Stamp chatId on the delivery doc
        await firestore().collection('deliveries').doc(delivery.id).update({
          chatId: chatRef.id,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        chatIdToUse = chatRef.id;
      } catch {
        carAlert.show('error', '', t('delivery.chatCreationError'));
        return;
      }
    }

    if (!chatIdToUse) {
      carAlert.show('info', '', t('delivery.chatNotAvailable'));
      return;
    }
    navigation.navigate('ChatRoom', {
      chatId: chatIdToUse,
      recipientName: driverName,
    });
  };

  return (
    <ScrollView
      ref={scrollViewRef}
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
            {delivery.item?.description || delivery.itemDescription || '—'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('delivery.priceLabel')}</Text>
          <Text style={[styles.priceValue, { color: colors.success }]}>
            {formatCurrency(delivery.price ?? delivery.suggestedPrice ?? 0)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>📅 {t('delivery.pickupDate')}</Text>
          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
            {(() => {
              const raw = (delivery as any).pickupDate ?? delivery.scheduledDate;
              if (!raw || raw === 'asap') return t('delivery.asap');
              const d = raw?.toDate ? raw.toDate() : typeof raw === 'string' ? new Date(raw) : raw?._seconds ? new Date(raw._seconds * 1000) : null;
              if (!d || isNaN(d.getTime())) return t('delivery.asap');
              return formatDate(d);
            })()}
            {(delivery as any).timeRange ? ` • ${({
              morning: t('delivery.timeRangeMorning'),
              afternoon: t('delivery.timeRangeAfternoon'),
              evening: t('delivery.timeRangeEvening'),
              night: t('delivery.timeRangeNight'),
            } as Record<string, string>)[(delivery as any).timeRange] || ''}` : ''}
          </Text>
        </View>
      </View>

      {/* ── 2. Horizontal Status Timeline (4 dynamic nodes) ── */}
      <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.timeline}>
          {timelineSteps.map((step, i) => (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <View
                  style={[
                    styles.timelineSegment,
                    { backgroundColor: colors.border },
                    step.completed || step.active ? { backgroundColor: colors.success } : undefined,
                  ]}
                />
              )}
              <View style={styles.timelineStation}>
                <View
                  style={[
                    styles.stationDot,
                    { backgroundColor: colors.border },
                    step.completed && { backgroundColor: colors.success },
                    step.active && { backgroundColor: colors.primary, borderWidth: 3, borderColor: 'rgba(26,115,232,0.3)' },
                  ]}
                />
                {step.active && (
                  <Text style={styles.truckIcon}>{({ bicycle: '🚲', bike: '🏍', car: '🚗', truck: '🚚' } as Record<string, string>)[delivery?.driverVehicleType || 'car'] || '🚗'}</Text>
                )}
                <Text
                  style={[
                    styles.stationLabel,
                    { color: colors.textSecondary },
                    step.completed && { color: colors.success, fontWeight: '600' },
                    step.active && { color: colors.primary, fontWeight: '700' },
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

      {/* ── 2b. Driver Approval Card (pending status) ── */}
      {delivery.status === 'pending' && delivery.driverId && (
        <DriverApprovalCard
          driverId={delivery.driverId}
          deliveryId={delivery.id}
        />
      )}

      {/* ── 2b2. Interested Drivers List — shown when status is 'new' and drivers have expressed interest ── */}
      {delivery.status === 'new' && (delivery as any).interestedDrivers?.length > 0 && (
        <InterestedDriversList
          interestedDrivers={(delivery as any).interestedDrivers}
          selectedDriverId={(delivery as any).selectedDriverId || null}
          selectionExpiresAt={(delivery as any).selectionExpiresAt ? new Date((delivery as any).selectionExpiresAt.seconds * 1000) : null}
          onSelect={handleSelectDriver}
          onViewProfile={handleViewProfile}
          onCancelSelection={handleCancelSelection}
        />
      )}

      {/* ── 2c. Delivery Proof Section (auto-scroll anchor) ── */}
      {(delivery.proof?.pickupURL || delivery.proof?.deliveryURL) && (() => {
        const proofImages: string[] = [];
        if (delivery.proof?.pickupURL) proofImages.push(delivery.proof.pickupURL);
        if (delivery.proof?.deliveryURL) proofImages.push(delivery.proof.deliveryURL);
        return (
          <View
            style={[styles.proofCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onLayout={(e) => { paymentSectionY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={[styles.proofTitle, { color: colors.textPrimary }]}>{t('deliveryExtra.deliveryProofs')}</Text>
            <View style={styles.proofRow}>
              {delivery.proof?.pickupURL && (
                <TouchableOpacity
                  style={styles.proofItem}
                  onPress={() => { setProofGalleryIndex(0); setProofGalleryVisible(true); }}
                >
                  <Image source={{ uri: delivery.proof.pickupURL }} style={styles.proofThumb} />
                  <Text style={[styles.proofLabel, { color: colors.textSecondary }]}>{t('deliveryExtra.pickupProof')}</Text>
                </TouchableOpacity>
              )}
              {delivery.proof?.deliveryURL && (
                <TouchableOpacity
                  style={styles.proofItem}
                  onPress={() => {
                    setProofGalleryIndex(delivery.proof?.pickupURL ? 1 : 0);
                    setProofGalleryVisible(true);
                  }}
                >
                  <Image source={{ uri: delivery.proof.deliveryURL }} style={styles.proofThumb} />
                  <Text style={[styles.proofLabel, { color: colors.textSecondary }]}>{t('deliveryExtra.deliveryProof')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <ImageGalleryModal
              visible={proofGalleryVisible}
              images={proofImages}
              initialIndex={proofGalleryIndex}
              onClose={() => setProofGalleryVisible(false)}
            />
          </View>
        );
      })()}

      {/* ── 2d. Payment Section (moved above map) ── */}
      {showPayment && (
        <View
          style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onLayout={(e) => { paymentSectionY.current = e.nativeEvent.layout.y; }}
        >
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

          {delivery.proof?.paymentURL && (
            <View style={styles.paymentProofRow}>
              <Image source={{ uri: delivery.proof.paymentURL }} style={styles.proofThumb} />
              <Text style={[styles.proofLabel, { color: colors.success }]}>{t('deliveryExtra.paymentProofUploaded')}</Text>
            </View>
          )}

          {/* Payment app buttons — open Bit or PayBox to send payment */}
          {!delivery.payment?.senderConfirmed && (
            <View style={styles.paymentAppsRow}>
              <TouchableOpacity
                style={[styles.paymentAppBtn, { backgroundColor: '#00D4AA' }]}
                onPress={() => Linking.openURL('https://www.bitpay.co.il/app/').catch(() =>
                  Linking.openURL('https://apps.apple.com/il/app/bit/id1080926498')
                )}
              >
                <Text style={styles.paymentAppBtnText}>{`💳 ${t('delivery.payBit')}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentAppBtn, { backgroundColor: '#FF6B00' }]}
                onPress={() => Linking.openURL('https://payboxapp.page.link/pay').catch(() =>
                  Linking.openURL('https://apps.apple.com/il/app/paybox/id1078498498')
                )}
              >
                <Text style={styles.paymentAppBtnText}>{`💳 ${t('delivery.payPaybox')}`}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!delivery.payment?.senderConfirmed && (
            <TouchableOpacity
              style={[styles.confirmPaymentButton, { backgroundColor: colors.primary }]}
              disabled={paymentUploading}
              onPress={() => {
                // Helper: upload photo and confirm payment
                const uploadAndConfirm = async (uri: string) => {
                  setPaymentUploading(true);
                  setLoadingSteps(['confirmingPayment', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
                  try {
                    const url = await uploadPaymentProof(delivery.id, uri);
                    await confirmPayment(delivery.id, url);
                    setPaymentUploading(false);
                    setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
                    carAlert.show('success', t('payment.successTitle'), t('payment.senderConfirmedMsg'));
                  } catch (e: any) {
                    setPaymentUploading(false);
                    setLoadingVisible(false);
                    carAlert.show('error', t('common.error'), e.message);
                  }
                };

                // Helper: show camera/gallery picker (step 2)
                const showPhotoPicker = () => {
                  Alert.alert(
                    `📸 ${t('delivery.paymentScreenshot')}`,
                    t('delivery.chooseImageSource'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: '📷 ' + t('common.takePhoto'),
                        onPress: async () => {
                          try {
                            if (Platform.OS === 'android') {
                              const granted = await PermissionsAndroid.request(
                                PermissionsAndroid.PERMISSIONS.CAMERA,
                                { title: t('permissions.cameraTitle'), message: t('delivery.cameraPermissionRequired'), buttonPositive: t('permissions.allow'), buttonNegative: t('common.cancel') },
                              );
                              if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
                            }
                            const result = await launchCamera({ mediaType: 'photo', quality: 0.5, maxWidth: 960, maxHeight: 960 });
                            if (result.didCancel || !result.assets?.[0]?.uri) return;
                            await uploadAndConfirm(result.assets[0].uri!);
                          } catch (e: any) { carAlert.show('error', t('common.error'), e.message); }
                        },
                      },
                      {
                        text: `🖼 ${t('delivery.fromGallery')}`,
                        onPress: async () => {
                          try {
                            const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.5, maxWidth: 960, maxHeight: 960, selectionLimit: 1 });
                            if (result.didCancel || !result.assets?.[0]?.uri) return;
                            await uploadAndConfirm(result.assets[0].uri!);
                          } catch (e: any) { carAlert.show('error', t('common.error'), e.message); }
                        },
                      },
                    ],
                  );
                };

                // Step 1: Confirm without photo or attach proof
                Alert.alert(
                  t('payment.confirmTitle'),
                  t('deliveryExtra.confirmPaymentPrompt'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('deliveryExtra.confirmWithoutScreenshot'),
                      onPress: async () => {
                        setLoadingSteps(['confirmingPayment', 'almostDone']); setLoadingStep(0); setLoadingVisible(true);
                        try {
                          await confirmPayment(delivery.id);
                          setLoadingStep(1); await new Promise(r => setTimeout(r, 600)); setLoadingVisible(false);
                          carAlert.show('success', t('payment.successTitle'), t('payment.senderConfirmedMsg'));
                        } catch (e: any) {
                          setLoadingVisible(false);
                          carAlert.show('error', t('common.error'), e.message);
                        }
                      },
                    },
                    {
                      text: t('deliveryExtra.uploadScreenshot'),
                      onPress: showPhotoPicker,
                    },
                  ],
                );
              }}
            >
              {paymentUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmPaymentButtonText}>{t('payment.confirmButton')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── 2e. Awaiting Payment Banner ── */}
      {delivery.status === 'awaiting_payment' && (
        <View style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.paymentTitle, { color: colors.textPrimary }]}>{`💳 ${t('delivery.paymentWaiting')}`}</Text>
          {delivery.payment?.senderConfirmed ? (
            <View style={{ backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginTop: 8 }}>
              <Text style={{ color: '#2E7D32', fontWeight: '600', textAlign: 'right' }}>
                {`✅ ${t('delivery.senderConfirmedPayment')}`}
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginTop: 8 }}>
              <Text style={{ color: '#F57C00', fontWeight: '600', textAlign: 'right' }}>
                {t('delivery.driverConfirmedPayment')}
              </Text>
            </View>
          )}
        </View>
      )}

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
            deliveryStatus={delivery.status}
            deliveredAt={deliveredAt}
            hideFabs
            onExpand={() =>
              navigation.navigate('FullScreenMap', {
                pickup: pickupCoords,
                destination: destCoords,
                driverId: delivery.driverId!,
                driverPhone,
                chatId: delivery.chatId,
                recipientName: driverName || t('home.driver'),
                deliveryStatus: delivery.status,
                deliveredAt: deliveredAt?.toISOString?.() ?? deliveredAt,
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
          {/* Top row: avatar + name + badges */}
          <View style={styles.driverTopRow}>
            <AvatarCircle name={driverName} photoUrl={driverPhoto} size={48} />
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

          {/* Action buttons */}
          <View style={styles.driverActions}>
            <TouchableOpacity
              style={[styles.driverBtn, { backgroundColor: colors.primary }]}
              onPress={handleChat}
            >
              <Text style={styles.driverBtnIcon}>💬</Text>
              <Text style={styles.driverBtnLabel}>{t('deliveryExtra.chatWithDriver')}</Text>
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

      {/* ── 5. Item Images (with add/delete) ── */}
      <View style={styles.mediaSection}>
        <View style={styles.mediaTitleRow}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            {t('deliveryExtra.itemPhotos')} ({imageCount}/5{hasVideo ? ` + ${t('deliveryExtra.video')}` : ''})
          </Text>
          {mediaUploading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaList}>
          {mediaList.map((url, i) => {
            const isVideo = isVideoUri(url);
            return (
              <TouchableOpacity
                key={`${i}-${url}`}
                style={styles.mediaThumbWrapper}
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
                    <Text style={{ color: '#fff', fontSize: 10, marginTop: 4 }}>{t('deliveryExtra.video')}</Text>
                  </View>
                ) : (
                  <Image source={{ uri: url }} style={styles.mediaThumb} />
                )}
                {canEditMedia && (
                  <TouchableOpacity
                    style={[styles.mediaDeleteBtn, { backgroundColor: colors.error }]}
                    onPress={() => handleDeleteMedia(url, i)}
                  >
                    <Text style={styles.mediaDeleteText}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Add photo button */}
          {canAddImage && (
            <TouchableOpacity
              style={[styles.mediaAddBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => handleAddMedia('photo')}
            >
              <Text style={[styles.mediaAddIcon, { color: colors.primary }]}>+</Text>
              <Text style={[styles.mediaAddLabel, { color: colors.textSecondary }]}>{t('deliveryExtra.photo')}</Text>
            </TouchableOpacity>
          )}
          {/* Add video button */}
          {canAddVideo && (
            <TouchableOpacity
              style={[styles.mediaAddBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => handleAddMedia('video')}
            >
              <Text style={[styles.mediaAddIcon, { color: colors.primary }]}>🎬</Text>
              <Text style={[styles.mediaAddLabel, { color: colors.textSecondary }]}>{t('deliveryExtra.video')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* ── Image Gallery Modal ── */}
      <ImageGalleryModal
        visible={galleryVisible}
        images={mediaList}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />

      {/* CarAlert modal */}
      <CarAlert visible={carAlert.visible} type={carAlert.type} title={carAlert.title} message={carAlert.message} buttons={carAlert.buttons} onDismiss={carAlert.dismiss} />

      <LoadingOverlay
        visible={loadingVisible}
        steps={loadingSteps}
        currentStep={loadingStep}
        timeout={60000}
        onTimeout={() => setLoadingVisible(false)}
        onCancel={() => setLoadingVisible(false)}
      />

      {/* ── 7. Secondary Actions (Edit / Delete / Cancel / Rate) ── */}
      <View style={styles.secondaryActions}>
        {canEditOrDelete && (
          <View style={styles.editDeleteRow}>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                const pickupLat = delivery.pickup?.lat ?? delivery.pickup?.latitude;
                const pickupLng = delivery.pickup?.lng ?? delivery.pickup?.longitude;
                const destLat = delivery.destination?.lat ?? delivery.destination?.latitude;
                const destLng = delivery.destination?.lng ?? delivery.destination?.longitude;
                navigation.navigate('CreateDelivery', {
                  editDeliveryId: delivery.id,
                  editData: {
                    pickup: pickupLat && pickupLng ? { latitude: pickupLat, longitude: pickupLng, address: delivery.pickup?.address || '' } : undefined,
                    destination: destLat && destLng ? { latitude: destLat, longitude: destLng, address: delivery.destination?.address || '' } : undefined,
                    itemDescription: delivery.item?.description || delivery.itemDescription || '',
                    itemSize: delivery.item?.size || delivery.itemSize || 'small',
                    suggestedPrice: delivery.price ?? delivery.suggestedPrice ?? 0,
                    scheduledDate: (() => {
                      const raw = (delivery as any).pickupDate ?? delivery.scheduledDate;
                      if (!raw || raw === 'asap') return 'asap';
                      if (raw?.toDate) return raw.toDate().toISOString();
                      if (typeof raw === 'string') return raw;
                      if (raw?._seconds) return new Date(raw._seconds * 1000).toISOString();
                      return null;
                    })(),
                    timeRange: (delivery as any).timeRange || null,
                    notes: delivery.notes || '',
                  },
                });
              }}
            >
              <Text style={styles.editBtnText}>{t('edit.editDelivery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, { borderColor: '#E53935' }]}
              onPress={() => setDeleteAlertVisible(true)}
            >
              <Text style={styles.deleteBtnText}>{t('edit.deleteDelivery')}</Text>
            </TouchableOpacity>
          </View>
        )}
        <AppAlert
          visible={deleteAlertVisible}
          icon="🗑️"
          title={t('edit.deleteDelivery')}
          message={t('edit.confirmDelete')}
          buttons={[
            { text: t('common.back'), style: 'cancel' },
            {
              text: t('deliveryExtra.deleteAction'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteDelivery(delivery.id);
                  carAlert.show('success', t('common.success'), t('edit.deleteSuccess'), [
                    { text: t('common.confirm'), onPress: () => navigation.goBack() },
                  ]);
                } catch (e: any) {
                  carAlert.show('error', t('common.error'), e.message);
                }
              },
            },
          ]}
          onDismiss={() => setDeleteAlertVisible(false)}
        />
        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: '#E53935' }]}
            onPress={() => setCancelAlertVisible(true)}
          >
            <Text style={styles.cancelBtnText}>{t('deliveryExtra.cancelDelivery')}</Text>
          </TouchableOpacity>
        )}
        <AppAlert
          visible={cancelAlertVisible}
          icon="🚛"
          title={t('deliveryExtra.cancelDelivery')}
          message={t('deliveryExtra.cancelPrompt')}
          buttons={[
            { text: t('common.back'), style: 'cancel' },
            {
              text: t('deliveryExtra.cancelAction'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await cancelDelivery(delivery.id);
                } catch (e: any) {
                  Alert.alert(t('common.error'), e.message);
                }
              },
            },
          ]}
          onDismiss={() => setCancelAlertVisible(false)}
        />
        {isPostPickup && (
          <View style={styles.cancelDisabledNote}>
            <Text style={[styles.cancelDisabledText, { color: colors.textSecondary }]}>
              ⚠️ {t('errors.cancelAfterPickup')}
            </Text>
          </View>
        )}

        {showRate && (
          <TouchableOpacity
            style={[styles.rateBtn, { backgroundColor: colors.accent }]}
            onPress={() => {
              navigatedToRating.current = true;
              navigation.navigate('Rating', {
                deliveryId: delivery.id,
                targetUserId: delivery.driverId || '',
              });
            }}
          >
            <Text style={styles.rateBtnText}>{t('delivery.rateDriver')}</Text>
          </TouchableOpacity>
        )}

        {/* Ratings summary — visible when both parties rated */}
        {delivery.ratedBySender && delivery.ratedByDriver && (
          <View style={[styles.ratingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.ratingsCardTitle, { color: colors.textPrimary }]}>{`⭐ ${t('delivery.ratingsSection')}`}</Text>

            {/* Sender's rating (about driver) */}
            {delivery.senderRatingGiven && (
              <View style={styles.ratingSummaryRow}>
                <Text style={[styles.ratingSummaryLabel, { color: colors.textSecondary }]}>
                  {t('delivery.yourRatingOnDriver')}
                </Text>
                <View style={styles.ratingStarsRow}>
                  <Text style={styles.ratingStarsGold}>
                    {'★'.repeat(delivery.senderRatingGiven.rating)}
                    {'☆'.repeat(5 - delivery.senderRatingGiven.rating)}
                  </Text>
                </View>
                {delivery.senderRatingGiven.comment ? (
                  <Text style={[styles.ratingSummaryComment, { color: colors.textPrimary }]} numberOfLines={2}>
                    &quot;{delivery.senderRatingGiven.comment}&quot;
                  </Text>
                ) : null}
              </View>
            )}

            {/* Driver's rating (about sender) */}
            {delivery.driverRatingGiven && (
              <View style={[styles.ratingSummaryRow, { marginTop: 12 }]}>
                <Text style={[styles.ratingSummaryLabel, { color: colors.textSecondary }]}>
                  {t('delivery.driverRatingOnYou')}
                </Text>
                <View style={styles.ratingStarsRow}>
                  <Text style={styles.ratingStarsGold}>
                    {'★'.repeat(delivery.driverRatingGiven.rating)}
                    {'☆'.repeat(5 - delivery.driverRatingGiven.rating)}
                  </Text>
                </View>
                {delivery.driverRatingGiven.comment ? (
                  <Text style={[styles.ratingSummaryComment, { color: colors.textPrimary }]} numberOfLines={2}>
                    &quot;{delivery.driverRatingGiven.comment}&quot;
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* Report driver button — visible when driver is assigned */}
        {delivery.driverId && (
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: colors.textTertiary }]}
            onPress={() => setReportVisible(true)}
          >
            <Text style={[styles.reportBtnText, { color: colors.textSecondary }]}>🚩 {t('report.reportDriver')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        reportedUserId={delivery.driverId || ''}
        reportedUserName={(delivery as any).driverName || ''}
        deliveryId={delivery.id}
        reportedRole="driver"
      />

      {profileDriverUid && (() => {
        const driver = (delivery as any).interestedDrivers?.find((d: any) => d.uid === profileDriverUid);
        if (!driver) return null;
        return (
          <DriverProfileModal
            visible={profileModalVisible}
            onClose={() => { setProfileModalVisible(false); setProfileDriverUid(null); }}
            driverUid={driver.uid}
            driverName={driver.name}
            driverPhotoUrl={driver.photoUrl}
            driverRating={driver.rating}
            driverCompletedDeliveries={driver.completedDeliveries}
            driverDistanceKm={driver.distanceKm}
            onSelect={() => handleSelectDriver(driver.uid)}
            selectionPending={!!(delivery as any).selectedDriverId}
          />
        );
      })()}
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
    gap: 6,
  },

  // ── Summary Card ──
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderStartWidth: 4,
    borderStartColor: '#1A73E8',
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
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
    width: 72,
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

  // ── Proof Section ──
  proofCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  proofTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  proofRow: {
    flexDirection: 'row',
    gap: 16,
  },
  proofItem: {
    alignItems: 'center',
    gap: 6,
  },
  proofThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  proofLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    marginTop: -40,
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
    gap: 10,
    marginBottom: 12,
  },
  driverName: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  driverBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
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
  mediaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  mediaList: {
    gap: 10,
  },
  mediaThumbWrapper: {
    position: 'relative',
  },
  mediaThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  mediaDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: { elevation: 3 },
    }),
  },
  mediaDeleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIcon: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  mediaAddBtn: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaAddIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  mediaAddLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Payment ──
  paymentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStartWidth: 4,
    borderStartColor: '#4CAF50',
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
  paymentProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  paymentAppsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  paymentAppBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  paymentAppBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
  editDeleteRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  editBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E53935',
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
  reportBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  reportBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelDisabledNote: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cancelDisabledText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
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
  ratingsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  ratingsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  ratingSummaryRow: {
    gap: 4,
  },
  ratingSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  ratingStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStarsGold: {
    fontSize: 18,
    color: '#FFB800',
    letterSpacing: 2,
  },
  ratingSummaryComment: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 2,
    writingDirection: 'rtl',
  },
});
