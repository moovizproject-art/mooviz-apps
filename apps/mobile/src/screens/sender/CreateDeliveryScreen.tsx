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
  photoUri: string | null;
  suggestedPrice: string;
  scheduledDate: string;
  notes: string;
}

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
    photoUri: null,
    suggestedPrice: '',
    scheduledDate: '',
    notes: '',
  });
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDestinationMap, setShowDestinationMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const updateField = <K extends keyof DeliveryForm>(key: K, value: DeliveryForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickPhoto = async (): Promise<void> => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });
    if (!result.didCancel && result.assets?.[0]) {
      updateField('photoUri', result.assets[0].uri!);
    }
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
        photoUri: form.photoUri,
        suggestedPrice: parseFloat(form.suggestedPrice) || 0,
        scheduledDate: form.scheduledDate || null,
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

        {/* Photo */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('form.itemPhoto')}
            </Text>
            <Text style={[styles.optionalText, { color: colors.textTertiary }]}>
              {t('form.optional')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.photoButton, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
            onPress={pickPhoto}
          >
            {form.photoUri ? (
              <Image source={{ uri: form.photoUri }} style={styles.photoPreview} />
            ) : (
              <>
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                  {t('form.chooseImage')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Pickup date */}
        <ThemedInput
          label={t('form.pickupDate')}
          required
          icon="📅"
          placeholder={t('form.datePlaceholder')}
          value={form.scheduledDate}
          onChangeText={(v) => updateField('scheduledDate', v)}
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
  photoButton: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderStyle: 'dashed',
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  photoIcon: {
    fontSize: 28,
    marginBottom: SPACING.sm,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.lg,
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
