import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { MapPicker } from '../../components/MapPicker';

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

/**
 * CreateDeliveryScreen — מסך יצירת משלוח
 * Form: pickup/destination map, item details, photo, price, date.
 * טופס: נקודת איסוף/יעד, פרטי פריט, תמונה, מחיר, תאריך
 */
export function CreateDeliveryScreen({ navigation }: Props): React.JSX.Element {
  const { currentUser } = useAuth();
  const { createDelivery } = useDelivery();

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
  const [showPickupMap, setShowPickupMap] = useState<boolean>(false);
  const [showDestinationMap, setShowDestinationMap] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
    // Validation
    if (!form.pickup) {
      Alert.alert('שגיאה', 'יש לבחור נקודת איסוף'); // Select pickup point
      return;
    }
    if (!form.destination) {
      Alert.alert('שגיאה', 'יש לבחור יעד'); // Select destination
      return;
    }
    if (!form.itemDescription.trim()) {
      Alert.alert('שגיאה', 'יש להוסיף תיאור פריט'); // Add item description
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
      Alert.alert('הצלחה', 'המשלוח נוצר בהצלחה!', [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
      // Success: Delivery created!
    } catch (err) {
      Alert.alert('שגיאה', 'לא ניתן ליצור משלוח. נסה שוב.');
      // Error: Cannot create delivery
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeOptions: { value: DeliveryForm['itemSize']; label: string }[] = [
    { value: 'small', label: 'קטן' /* Small */ },
    { value: 'medium', label: 'בינוני' /* Medium */ },
    { value: 'large', label: 'גדול' /* Large */ },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Pickup location */}
      {/* נקודת איסוף */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>נקודת איסוף</Text>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => setShowPickupMap(true)}
        >
          <Text style={form.pickup ? styles.locationText : styles.locationPlaceholder}>
            {form.pickup?.address || 'בחר מיקום איסוף'}
            {/* Select pickup location */}
          </Text>
        </TouchableOpacity>
        {showPickupMap && (
          <MapPicker
            onLocationSelect={(point) => {
              updateField('pickup', point);
              setShowPickupMap(false);
            }}
            onCancel={() => setShowPickupMap(false)}
          />
        )}
      </View>

      {/* Destination */}
      {/* יעד */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>יעד</Text>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => setShowDestinationMap(true)}
        >
          <Text style={form.destination ? styles.locationText : styles.locationPlaceholder}>
            {form.destination?.address || 'בחר יעד'}
            {/* Select destination */}
          </Text>
        </TouchableOpacity>
        {showDestinationMap && (
          <MapPicker
            onLocationSelect={(point) => {
              updateField('destination', point);
              setShowDestinationMap(false);
            }}
            onCancel={() => setShowDestinationMap(false)}
          />
        )}
      </View>

      {/* Item description */}
      {/* תיאור הפריט */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>תיאור הפריט</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.itemDescription}
          onChangeText={(v) => updateField('itemDescription', v)}
          placeholder="מה אתה שולח? (למשל: חבילה קטנה, מסמכים...)"
          multiline
          numberOfLines={3}
          textAlign="right"
          textAlignVertical="top"
        />
      </View>

      {/* Item size */}
      {/* גודל הפריט */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>גודל</Text>
        <View style={styles.sizeRow}>
          {sizeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sizeChip, form.itemSize === opt.value && styles.sizeChipActive]}
              onPress={() => updateField('itemSize', opt.value)}
            >
              <Text
                style={[
                  styles.sizeChipText,
                  form.itemSize === opt.value && styles.sizeChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Item photo */}
      {/* תמונת הפריט */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>תמונת הפריט (אופציונלי)</Text>
        <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
          {form.photoUri ? (
            <Image source={{ uri: form.photoUri }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.photoButtonText}>הוסף תמונה</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Suggested price */}
      {/* מחיר מוצע */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>מחיר מוצע (₪)</Text>
        <TextInput
          style={styles.input}
          value={form.suggestedPrice}
          onChangeText={(v) => updateField('suggestedPrice', v)}
          placeholder="0"
          keyboardType="numeric"
          textAlign="right"
        />
      </View>

      {/* Scheduled date */}
      {/* תאריך מבוקש */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>תאריך מבוקש (אופציונלי)</Text>
        <TextInput
          style={styles.input}
          value={form.scheduledDate}
          onChangeText={(v) => updateField('scheduledDate', v)}
          placeholder="DD/MM/YYYY"
          textAlign="right"
        />
      </View>

      {/* Notes */}
      {/* הערות */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>הערות נוספות</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.notes}
          onChangeText={(v) => updateField('notes', v)}
          placeholder="הנחיות מיוחדות, קוד כניסה וכו׳..."
          multiline
          numberOfLines={2}
          textAlign="right"
          textAlignVertical="top"
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'יוצר משלוח...' : 'צור משלוח'}
          {/* Creating delivery... / Create delivery */}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  textArea: {
    minHeight: 80,
  },
  locationButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
  },
  locationText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'right',
  },
  locationPlaceholder: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  sizeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sizeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  sizeChipTextActive: {
    color: '#FFFFFF',
  },
  photoButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  photoButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
