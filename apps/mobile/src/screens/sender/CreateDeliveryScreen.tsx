import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';

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
  itemSize: 'small' | 'medium' | 'large';
  mediaUris: string[];
  suggestedPrice: string;
  scheduledDate: Date | null;
  isAsap: boolean;
  notes: string;
}

const isVideoUri = (uri: string): boolean => {
  const lower = uri.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.includes('video');
};

export function CreateDeliveryScreen({ navigation }: Props): React.JSX.Element {
  const { currentUser } = useAuth();
  const { createDelivery } = useDelivery({
    userId: currentUser?.uid,
    role: 'sender',
  });
  const { colors } = useTheme();
  const { t } = useI18n();
  const carAlert = useCarAlert();

  const [form, setForm] = useState<DeliveryForm>({
    pickup: null,
    destination: null,
    itemDescription: '',
    itemSize: 'small',
    mediaUris: [],
    suggestedPrice: '',
    scheduledDate: null,
    isAsap: true,
    notes: '',
  });
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDestinationMap, setShowDestinationMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const updateField = <K extends keyof DeliveryForm>(key: K, value: DeliveryForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const imageCount = form.mediaUris.filter(u => !isVideoUri(u)).length;
  const hasVideo = form.mediaUris.some(u => isVideoUri(u));

  const handleAddPhotos = async (): Promise<void> => {
    const maxNew = 5 - imageCount;
    if (maxNew <= 0) return;
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
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

  const handleAddVideo = async (): Promise<void> => {
    if (hasVideo) return;
    try {
      const result = await launchImageLibrary({ mediaType: 'video' });
      if (!result.didCancel && result.assets?.[0]?.uri) {
        // Compress video
        const { Video } = require('react-native-compressor');
        const compressed = await Video.compress(result.assets[0].uri, { compressionMethod: 'auto' });
        updateField('mediaUris', [...form.mediaUris, compressed]);
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
      carAlert.show('error', t('common.error'), t('delivery.errorPickup'));
      return;
    }
    if (!form.destination) {
      carAlert.show('error', t('common.error'), t('delivery.errorDestination'));
      return;
    }
    if (!form.itemDescription.trim()) {
      carAlert.show('error', t('common.error'), t('delivery.errorDescription'));
      return;
    }

    try {
      setIsSubmitting(true);
      await createDelivery({
        senderId: currentUser!.uid,
        pickup: form.pickup,
        destination: form.destination,
        itemDescription: form.itemDescription,
        itemSize: form.itemSize,
        mediaUris: form.mediaUris,
        suggestedPrice: parseFloat(form.suggestedPrice) || 0,
        scheduledDate: form.isAsap ? 'asap' : (form.scheduledDate ? form.scheduledDate.toISOString() : null),
        notes: form.notes,
      });
      carAlert.show('success', t('common.success'), t('delivery.createdSuccess'), [
        { text: t('common.confirm'), onPress: () => navigation.goBack() },
      ]);
    } catch {
      carAlert.show('error', t('common.error'), t('delivery.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeOptions: { value: DeliveryForm['itemSize']; label: string }[] = [
    { value: 'small', label: t('form.sizeSmall') },
    { value: 'medium', label: t('form.sizeMedium') },
    { value: 'large', label: t('form.sizeLarge') },
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t('form.newDeliveries')}
        onBack={() => navigation.goBack()}
        rightElement={infoButton}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
          {t('form.addDelivery')}
        </Text>

        {/* Pickup */}
        <ThemedInput
          label={t('form.pickupAddress')}
          required
          placeholder={t('form.pickupPlaceholder')}
          onPress={() => setShowPickupMap(true)}
          displayValue={form.pickup?.address}
        />
        {showPickupMap && (
          <MapPicker
            onLocationSelect={(point) => {
              updateField('pickup', point);
              setShowPickupMap(false);
            }}
            onCancel={() => setShowPickupMap(false)}
          />
        )}

        {/* Destination */}
        <ThemedInput
          label={t('form.destination')}
          required
          placeholder={t('form.destinationPlaceholder')}
          onPress={() => setShowDestinationMap(true)}
          displayValue={form.destination?.address}
        />
        {showDestinationMap && (
          <MapPicker
            onLocationSelect={(point) => {
              updateField('destination', point);
              setShowDestinationMap(false);
            }}
            onCancel={() => setShowDestinationMap(false)}
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
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('form.itemSize')}
          </Text>
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
              <TouchableOpacity style={[styles.addMediaButton, { borderColor: colors.border }]} onPress={handleAddPhotos}>
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
        />

        {/* Price */}
        <ThemedInput
          label={t('form.suggestedPrice')}
          required
          placeholder="0"
          value={form.suggestedPrice}
          onChangeText={(v) => updateField('suggestedPrice', v)}
          keyboardType="numeric"
        />

        {/* Notes */}
        <ThemedInput
          label={t('form.notes')}
          placeholder={t('form.notesPlaceholder')}
          value={form.notes}
          onChangeText={(v) => updateField('notes', v)}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
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
              {isSubmitting ? t('form.creatingDelivery') : t('common.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
    </View>
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
    ...SHADOWS.sm,
  },
  sizeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mediaSection: {
    marginBottom: SPACING.lg,
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
});
