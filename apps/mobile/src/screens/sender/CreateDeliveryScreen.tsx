import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  Platform,
  PermissionsAndroid,
  ActionSheetIOS,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { MapPicker } from '../../components/MapPicker';
import { ThemedInput } from '../../components/ThemedInput';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DatePickerInput } from '../../components/DatePickerInput';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/tokens';
import { CarAlert, useCarAlert } from '../../components/CarAlert';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { strings } from '../../i18n/strings';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateDelivery'>;

interface GeoPoint {
  latitude: number;
  longitude: number;
  address: string;
}

interface DeliveryForm {
  pickup: GeoPoint | null;
  destination: GeoPoint | null;
  itemDescription: string;
  itemSize: 'small' | 'medium' | 'large' | 'xlarge';
  mediaUris: string[];
  suggestedPrice: string;
  scheduledDate: Date | null;
  isAsap: boolean;
  notes: string;
  timeRange: string | null;
}

const isVideoUri = (uri: string): boolean => {
  const lower = uri.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.includes('video');
};

export function CreateDeliveryScreen({ navigation, route }: Props): React.JSX.Element {
  const { currentUser } = useAuth();
  const { createDelivery, editDelivery } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
  });
  const { colors } = useTheme();
  const { t } = useI18n();
  const carAlert = useCarAlert();

  // Edit mode: pre-fill from route params
  const editDeliveryId = route.params?.editDeliveryId;
  const editData = route.params?.editData;
  const isEditMode = !!editDeliveryId;

  const [form, setForm] = useState<DeliveryForm>(() => {
    if (editData) {
      const isAsap = !editData.scheduledDate || editData.scheduledDate === 'asap';
      return {
        pickup: editData.pickup ? { latitude: editData.pickup.latitude, longitude: editData.pickup.longitude, address: editData.pickup.address } : null,
        destination: editData.destination ? { latitude: editData.destination.latitude, longitude: editData.destination.longitude, address: editData.destination.address } : null,
        itemDescription: editData.itemDescription || '',
        itemSize: (editData.itemSize as DeliveryForm['itemSize']) || 'small',
        mediaUris: [],
        suggestedPrice: editData.suggestedPrice ? String(editData.suggestedPrice) : '',
        scheduledDate: !isAsap && editData.scheduledDate ? new Date(editData.scheduledDate) : null,
        isAsap,
        notes: editData.notes || '',
        timeRange: editData.timeRange || null,
      };
    }
    return {
      pickup: null,
      destination: null,
      itemDescription: '',
      itemSize: 'small',
      mediaUris: [],
      suggestedPrice: '',
      scheduledDate: null,
      isAsap: true,
      notes: '',
      timeRange: null,
    };
  });
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDestinationMap, setShowDestinationMap] = useState(false);
  const [mapInitialLocation, setMapInitialLocation] = useState<{ latitude: number; longitude: number } | undefined>(undefined);

  const openMapAtMyLocation = useCallback((target: 'pickup' | 'destination') => {
    Geolocation.getCurrentPosition(
      (pos) => {
        setMapInitialLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        if (target === 'pickup') setShowPickupMap(true);
        else setShowDestinationMap(true);
      },
      () => {
        // Fallback: open map without initial location
        setMapInitialLocation(undefined);
        if (target === 'pickup') setShowPickupMap(true);
        else setShowDestinationMap(true);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showSizeInfo, setShowSizeInfo] = useState(false);

  const updateField = <K extends keyof DeliveryForm>(key: K, value: DeliveryForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const imageCount = form.mediaUris.filter(u => !isVideoUri(u)).length;
  const hasVideo = form.mediaUris.some(u => isVideoUri(u));

  const showMediaPicker = (): void => {
    const options = ['\u{1F4F8} \u05E6\u05DC\u05DD \u05EA\u05DE\u05D5\u05E0\u05D4', '\u{1F5BC} \u05D1\u05D7\u05E8 \u05DE\u05D4\u05D2\u05DC\u05E8\u05D9\u05D4', '\u05D1\u05D9\u05D8\u05D5\u05DC'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) handleTakePhoto();
          else if (index === 1) handleAddPhotos();
        },
      );
    } else {
      setShowMediaModal(true);
    }
  };

  const [showMediaModal, setShowMediaModal] = useState(false);

  const handleAddPhotos = async (): Promise<void> => {
    const maxNew = 5 - imageCount;
    if (maxNew <= 0) return;
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        selectionLimit: maxNew,
      });
      if (!result.didCancel && result.assets) {
        const newUris = result.assets.map(a => a.uri!).filter(Boolean);
        updateField('mediaUris', [...form.mediaUris, ...newUris]);
      }
    } catch (e) {
      console.warn('Image pick error:', e);
    }
  };

  const handleTakePhoto = async (): Promise<void> => {
    if (imageCount >= 5) return;
    try {
      // Request camera permission on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: strings.permissions.cameraTitle.he,
            message: strings.permissions.cameraMessage.he,
            buttonPositive: strings.permissions.allow.he,
            buttonNegative: strings.common.cancel.he,
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('Camera permission denied');
          return;
        }
      }
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        saveToPhotos: false,
      });
      if (!result.didCancel && result.assets?.[0]?.uri) {
        updateField('mediaUris', [...form.mediaUris, result.assets[0].uri]);
      }
    } catch (e) {
      console.warn('Camera error:', e);
    }
  };

  const handleAddVideo = async (): Promise<void> => {
    if (hasVideo) return;
    try {
      const result = await launchImageLibrary({ mediaType: 'video' });
      if (!result.didCancel && result.assets?.[0]?.uri) {
        let videoUri = result.assets[0].uri;
        // Compress video if compressor available (requires native rebuild)
        try {
          const { Video } = require('react-native-compressor');
          videoUri = await Video.compress(videoUri, { compressionMethod: 'auto' });
        } catch {
          console.warn('[CreateDelivery] react-native-compressor not available, using raw video');
        }
        updateField('mediaUris', [...form.mediaUris, videoUri]);
      }
    } catch (e) {
      console.warn('Video pick error:', e);
    }
  };

  const handleRemoveMedia = (index: number): void => {
    updateField('mediaUris', form.mediaUris.filter((_, i) => i !== index));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!form.pickup) {
      carAlert.show('error', t('form.validationError'), t('delivery.errorPickup'));
      return;
    }
    if (form.pickup.latitude === 0 && form.pickup.longitude === 0) {
      carAlert.show('error', t('form.validationError'), 'יש לבחור כתובת איסוף תקינה מהמפה');
      return;
    }
    if (!form.destination) {
      carAlert.show('error', t('form.validationError'), t('delivery.errorDestination'));
      return;
    }
    if (form.destination.latitude === 0 && form.destination.longitude === 0) {
      carAlert.show('error', t('form.validationError'), 'יש לבחור כתובת יעד תקינה מהמפה');
      return;
    }
    if (!form.itemDescription.trim()) {
      carAlert.show('error', t('form.validationError'), t('delivery.errorDescription'));
      return;
    }
    if (!form.suggestedPrice || parseFloat(form.suggestedPrice) <= 0) {
      carAlert.show('error', t('form.validationError'), t('delivery.errorPrice'));
      return;
    }

    setLoadingVisible(true);
    setLoadingStep(0);
    try {
      setIsSubmitting(true);

      if (isEditMode && editDeliveryId) {
        // Edit mode: call editDelivery callable
        setLoadingStep(1);
        await editDelivery(editDeliveryId, {
          pickup: form.pickup || undefined,
          destination: form.destination || undefined,
          itemDescription: form.itemDescription,
          itemSize: form.itemSize,
          suggestedPrice: parseFloat(form.suggestedPrice) || 0,
          scheduledDate: form.isAsap ? 'asap' : (form.scheduledDate ? form.scheduledDate.toISOString() : null),
          timeRange: form.isAsap ? null : (form.timeRange ?? null),
          notes: form.notes,
        });
        setLoadingStep(2);
        await new Promise(r => setTimeout(r, 800));
        setLoadingVisible(false);
        carAlert.show('success', strings.common.success.he, strings.edit.editSuccess.he, [
          { text: t('common.confirm'), onPress: () => navigation.goBack() },
        ]);
      } else {
        // Create mode
        // Step 0: uploading images (handled inside createDelivery)
        setLoadingStep(0);
        // Step 1: creating delivery (Cloud Function / Firestore write)
        setLoadingStep(1);
        await createDelivery({
          senderId: currentUser!.uid,
          senderName: currentUser!.fullName,
          senderPhotoUrl: currentUser!.profilePhotoURL,
          senderRating: currentUser!.ratingAsSender?.average ?? 0,
          pickup: form.pickup,
          destination: form.destination,
          itemDescription: form.itemDescription,
          itemSize: form.itemSize,
          mediaUris: form.mediaUris,
          suggestedPrice: parseFloat(form.suggestedPrice) || 0,
          scheduledDate: form.isAsap ? 'asap' : (form.scheduledDate ? form.scheduledDate.toISOString() : null),
          timeRange: form.isAsap ? null : (form.timeRange ?? null),
          notes: form.notes,
        });
        setLoadingStep(2);
        await new Promise(r => setTimeout(r, 800));
        setLoadingVisible(false);
        carAlert.show('success', t('form.deliveryCreated'), t('delivery.createdSuccess'), [
          { text: t('common.confirm'), onPress: () => {
            // Go back to home feed after creating a delivery
            navigation.goBack();
          }},
        ]);
      }
    } catch (e: any) {
      setLoadingVisible(false);
      const msg = e?.message || e?.userInfo?.message || (isEditMode ? strings.edit.editError.he : t('delivery.createError'));
      carAlert.show('error', isEditMode ? strings.edit.editError.he : t('form.deliveryError'), msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeOptions: { value: DeliveryForm['itemSize']; label: string; icon: string; hint: string }[] = [
    { value: 'small', label: t('form.sizeSmall'), icon: '✉️', hint: t('form.sizeSmallHint') },
    { value: 'medium', label: t('form.sizeMedium'), icon: '📦', hint: t('form.sizeMediumHint') },
    { value: 'large', label: t('form.sizeLarge'), icon: '📦📦', hint: t('form.sizeLargeHint') },
    { value: 'xlarge', label: t('form.sizeOther'), icon: '🚚', hint: t('form.sizeOtherHint') },
  ];

  const infoButton = (
    <TouchableOpacity
      style={styles.infoButton}
      onPress={() => setShowHelp(true)}
    >
      <Text style={styles.infoIcon}>?</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScreenHeader
        title={isEditMode ? strings.edit.editDelivery.he : t('form.newDeliveries')}
        onBack={() => navigation.goBack()}
        rightElement={infoButton}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Title */}
        <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
          {isEditMode ? strings.edit.editDelivery.he : t('form.addDelivery')}
        </Text>

        {/* Pickup */}
        <ThemedInput
          label={t('form.pickupAddress')}
          required
          placeholder={t('form.pickupPlaceholder')}
          onPress={() => { setMapInitialLocation(undefined); setShowPickupMap(true); }}
          displayValue={form.pickup?.address}
          rightIcon="📍"
          onRightIconPress={() => openMapAtMyLocation('pickup')}
        />
        {showPickupMap && (
          <MapPicker
            initialLocation={mapInitialLocation}
            onLocationSelect={(point) => {
              updateField('pickup', point);
              setShowPickupMap(false);
              setMapInitialLocation(undefined);
            }}
            onCancel={() => { setShowPickupMap(false); setMapInitialLocation(undefined); }}
          />
        )}

        {/* Destination */}
        <ThemedInput
          label={t('form.destination')}
          required
          placeholder={t('form.destinationPlaceholder')}
          onPress={() => { setMapInitialLocation(undefined); setShowDestinationMap(true); }}
          displayValue={form.destination?.address}
          rightIcon="📍"
          onRightIconPress={() => openMapAtMyLocation('destination')}
        />
        {showDestinationMap && (
          <MapPicker
            initialLocation={mapInitialLocation}
            onLocationSelect={(point) => {
              updateField('destination', point);
              setShowDestinationMap(false);
              setMapInitialLocation(undefined);
            }}
            onCancel={() => { setShowDestinationMap(false); setMapInitialLocation(undefined); }}
          />
        )}

        {/* Item description */}
        <ThemedInput
          label={t('form.itemDescription')}
          required
          placeholder={t('form.itemDescPlaceholder')}
          value={form.itemDescription}
          onChangeText={(v) => updateField('itemDescription', v)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Item size */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('form.itemSize')}
            </Text>
            <TouchableOpacity onPress={() => setShowSizeInfo(true)}>
              <Text style={[styles.sizeInfoBtn, { color: colors.primary }]}>ℹ️ {t('form.sizes')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sizeRow}>
            {sizeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.sizeChip,
                  { borderColor: colors.border, backgroundColor: colors.inputBg },
                  form.itemSize === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => updateField('itemSize', opt.value)}
              >
                <Text style={styles.sizeChipIcon}>{opt.icon}</Text>
                <Text
                  style={[
                    styles.sizeChipText,
                    { color: colors.textPrimary },
                    form.itemSize === opt.value && { color: colors.textInverse },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes — under "מידע נוסף" label, above gallery */}
        <ThemedInput
          label={t('form.notes')}
          placeholder={t('form.notesPlaceholder')}
          value={form.notes}
          onChangeText={(v) => updateField('notes', v)}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        {/* Media — photos + video */}
        <View style={styles.mediaSection}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('form.media')}
            </Text>
            <Text style={[styles.optionalText, { color: colors.textTertiary }]}>
              {t('form.optional')}
            </Text>
          </View>
          {form.mediaUris.length === 0 ? (
            <View style={styles.mediaCenteredRow}>
              {imageCount < 5 && (
                <TouchableOpacity style={[styles.addMediaButton, { borderColor: colors.border }]} onPress={showMediaPicker}>
                  <Text style={styles.addMediaIconText}>{'\uD83D\uDCF7'}</Text>
                  <Text style={[styles.addMediaText, { color: colors.textSecondary }]}>{t('form.addPhoto')}</Text>
                </TouchableOpacity>
              )}
              {!hasVideo && (
                <TouchableOpacity style={[styles.addMediaButton, { borderColor: colors.border }]} onPress={handleAddVideo}>
                  <Text style={styles.addMediaIconText}>{'\uD83C\uDFAC'}</Text>
                  <Text style={[styles.addMediaText, { color: colors.textSecondary }]}>{t('form.addVideo')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaStrip}>
              {form.mediaUris.map((uri, index) => (
                <View key={index} style={styles.mediaThumbnailContainer}>
                  <Image source={{ uri }} style={styles.mediaThumbnail} />
                  {isVideoUri(uri) && (
                    <View style={styles.videoOverlay}>
                      <Text style={styles.videoIcon}>{'\u25B6'}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeMediaButton} onPress={() => handleRemoveMedia(index)}>
                    <Text style={styles.removeMediaIcon}>{'\u2715'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {imageCount < 5 && (
                <TouchableOpacity style={[styles.addMediaButton, { borderColor: colors.border }]} onPress={showMediaPicker}>
                  <Text style={styles.addMediaIconText}>{'\uD83D\uDCF7'}</Text>
                  <Text style={[styles.addMediaText, { color: colors.textSecondary }]}>{t('form.addPhoto')}</Text>
                </TouchableOpacity>
              )}
              {!hasVideo && (
                <TouchableOpacity style={[styles.addMediaButton, { borderColor: colors.border }]} onPress={handleAddVideo}>
                  <Text style={styles.addMediaIconText}>{'\uD83C\uDFAC'}</Text>
                  <Text style={[styles.addMediaText, { color: colors.textSecondary }]}>{t('form.addVideo')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
          <Text style={[styles.mediaHint, { color: colors.textSecondary }]}>
            {t('form.mediaHint', { imageCount: String(imageCount), videoSuffix: hasVideo ? t('form.mediaHintVideo') : '' })}
          </Text>
        </View>

        {/* Pickup date */}
        <DatePickerInput
          value={form.scheduledDate}
          isAsap={form.isAsap}
          onDateChange={(date) => updateField('scheduledDate', date)}
          onAsapToggle={(val) => updateField('isAsap', val)}
          timeRange={form.timeRange}
          onTimeRangeChange={(range) => updateField('timeRange', range)}
        />

        {/* Price */}
        <ThemedInput
          label={t('form.suggestedPrice')}
          required
          placeholder="0"
          value={form.suggestedPrice ? `₪${form.suggestedPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : ''}
          onChangeText={(v) => updateField('suggestedPrice', v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
        />

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={[styles.submitButtonText, { color: colors.textInverse }]}>
              {isSubmitting
                ? (isEditMode ? strings.edit.updatingDelivery.he : t('form.creatingDelivery'))
                : (isEditMode ? strings.edit.updateDelivery.he : t('common.submit'))}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Legal disclaimer */}
        <Text style={[styles.legalDisclaimer, { color: colors.textTertiary }]}>
          {t('auth.acceptTerms')}{' '}
          <Text
            style={{ color: colors.primary }}
            onPress={() => Linking.openURL('https://admin.mooviz.co.il/terms')}
          >
            {t('terms.termsOfService')}
          </Text>
          {' '}{t('common.and')}{' '}
          <Text
            style={{ color: colors.primary }}
            onPress={() => Linking.openURL('https://admin.mooviz.co.il/privacy')}
          >
            {t('terms.privacyPolicy')}
          </Text>
        </Text>
      </ScrollView>

      {/* Size info modal */}
      <Modal visible={showSizeInfo} transparent animationType="fade" onRequestClose={() => setShowSizeInfo(false)}>
        <View style={styles.helpOverlay}>
          <View style={[styles.helpCard, { backgroundColor: colors.background }]}>
            <View style={[styles.helpHeader, { backgroundColor: colors.accent }]}>
              <Text style={styles.helpHeaderTitle}>📏 {t('form.sizeGuide')}</Text>
            </View>
            <ScrollView style={styles.helpScroll} contentContainerStyle={styles.helpScrollContent}>
              {sizeOptions.map((opt) => (
                <View key={opt.value} style={[styles.sizeInfoRow, { borderBottomColor: colors.border }]}>
                  <Text style={styles.sizeInfoIcon}>{opt.icon}</Text>
                  <View style={styles.sizeInfoContent}>
                    <Text style={[styles.sizeInfoTitle, { color: colors.textPrimary }]}>{opt.label}</Text>
                    <Text style={[styles.sizeInfoHint, { color: colors.textSecondary }]}>{opt.hint}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.helpButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowSizeInfo(false)}
            >
              <Text style={styles.helpButtonText}>{t('form.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help modal */}
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.helpOverlay}>
          <View style={[styles.helpCard, { backgroundColor: colors.background }]}>
            <View style={[styles.helpHeader, { backgroundColor: colors.primary }]}>
              <Text style={styles.helpHeaderTitle}>{t('form.helpTitle')}</Text>
            </View>
            <ScrollView style={styles.helpScroll} contentContainerStyle={styles.helpScrollContent}>
              <Text style={[styles.helpBody, { color: colors.textPrimary }]}>
                {t('form.helpBody')}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.helpButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowHelp(false)}
            >
              <Text style={styles.helpButtonText}>{t('form.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <CarAlert visible={carAlert.visible} type={carAlert.type} title={carAlert.title} message={carAlert.message} buttons={carAlert.buttons} onDismiss={carAlert.dismiss} />

      {/* Android media source picker modal */}
      <Modal visible={showMediaModal} transparent animationType="fade" onRequestClose={() => setShowMediaModal(false)}>
        <TouchableOpacity style={styles.mediaModalOverlay} activeOpacity={1} onPress={() => setShowMediaModal(false)}>
          <View style={[styles.mediaModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.mediaModalOption, { borderBottomColor: colors.border }]}
              onPress={() => { setShowMediaModal(false); handleTakePhoto(); }}
            >
              <Text style={[styles.mediaModalOptionText, { color: colors.textPrimary }]}>{'\uD83D\uDCF8'}  {'\u05E6\u05DC\u05DD \u05EA\u05DE\u05D5\u05E0\u05D4'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaModalOption, { borderBottomColor: colors.border }]}
              onPress={() => { setShowMediaModal(false); handleAddPhotos(); }}
            >
              <Text style={[styles.mediaModalOptionText, { color: colors.textPrimary }]}>{'\uD83D\uDDBC'}  {'\u05D1\u05D7\u05E8 \u05DE\u05D4\u05D2\u05DC\u05E8\u05D9\u05D4'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaModalOption}
              onPress={() => setShowMediaModal(false)}
            >
              <Text style={[styles.mediaModalOptionText, { color: colors.error }]}>{'\u05D1\u05D9\u05D8\u05D5\u05DC'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <LoadingOverlay
        visible={loadingVisible}
        steps={['uploadingImages', 'creatingDelivery', 'almostDone']}
        currentStep={loadingStep}
        timeout={60000}
        onTimeout={() => {
          setLoadingVisible(false);
          carAlert.show('error', t('common.error'), t('delivery.createError'));
        }}
        onCancel={() => setLoadingVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.xxl,
    paddingBottom: 48,
  },
  formTitle: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
    fontWeight: '700',
  },
  optionalText: {
    ...TYPOGRAPHY.caption,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
    ...SHADOWS.sm,
  },
  sizeChipIcon: {
    fontSize: 20,
  },
  sizeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sizeInfoBtn: {
    fontSize: 13,
    fontWeight: '600',
  },
  sizeInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sizeInfoIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  sizeInfoContent: {
    flex: 1,
  },
  sizeInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sizeInfoHint: {
    fontSize: 13,
    lineHeight: 20,
  },
  mediaSection: {
    marginBottom: SPACING.lg,
  },
  mediaCenteredRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mediaStrip: {
    flexDirection: 'row',
  },
  mediaThumbnailContainer: {
    width: 80,
    height: 80,
    marginEnd: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    color: '#fff',
    fontSize: 24,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaIcon: {
    color: '#fff',
    fontSize: 12,
  },
  addMediaButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: 8,
  },
  addMediaIconText: {
    fontSize: 24,
    marginBottom: 4,
  },
  addMediaText: {
    fontSize: 10,
    textAlign: 'center',
  },
  mediaHint: {
    fontSize: 11,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xxl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...TYPOGRAPHY.button,
  },
  submitButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...TYPOGRAPHY.button,
    fontWeight: '700',
  },
  legalDisclaimer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  helpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  helpCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '75%',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  helpHeader: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  helpHeaderIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  helpHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  helpScroll: {
    maxHeight: 400,
  },
  helpScrollContent: {
    padding: 24,
  },
  helpBody: {
    fontSize: 15,
    lineHeight: 24,
  },
  helpButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  mediaModalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  mediaModalOption: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mediaModalOptionText: {
    fontSize: 17,
    textAlign: 'center',
  },
});
