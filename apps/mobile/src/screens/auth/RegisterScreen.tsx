import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { validatePhone, validateEmail, validateRequired } from '../../utils/validators';
import { sendOTP } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type UserRole = 'sender' | 'driver' | 'both';

interface RegisterForm {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  role: UserRole;
  profilePhotoUri: string | null;
  kycDocumentUri: string | null;
}

/**
 * RegisterScreen — מסך הרשמה
 * Collects name, phone, email, city, role, profile photo, and KYC document.
 * אוסף שם, טלפון, אימייל, עיר, תפקיד, תמונת פרופיל ומסמך KYC
 */
export function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const [form, setForm] = useState<RegisterForm>({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    role: 'sender',
    profilePhotoUri: null,
    kycDocumentUri: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});

  const updateField = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const pickImage = async (field: 'profilePhotoUri' | 'kycDocumentUri'): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: field === 'profilePhotoUri',
      aspect: field === 'profilePhotoUri' ? [1, 1] : undefined,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      updateField(field, result.assets[0].uri);
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof RegisterForm, string>> = {};
    if (!validateRequired(form.fullName)) newErrors.fullName = 'שם מלא נדרש'; // Full name required
    if (!validatePhone(form.phone)) newErrors.phone = 'מספר טלפון לא תקין'; // Invalid phone
    if (!validateEmail(form.email)) newErrors.email = 'אימייל לא תקין'; // Invalid email
    if (!validateRequired(form.city)) newErrors.city = 'עיר נדרשת'; // City required

    // KYC document required for drivers
    if ((form.role === 'driver' || form.role === 'both') && !form.kycDocumentUri) {
      newErrors.kycDocumentUri = 'מסמך זיהוי נדרש לנהגים'; // KYC required for drivers
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (): Promise<void> => {
    if (!validate()) return;

    try {
      setIsLoading(true);
      const verificationId = await sendOTP(form.phone);
      navigation.navigate('OTPVerification', {
        phoneNumber: form.phone,
        verificationId,
      });
    } catch (err) {
      Alert.alert('שגיאה', 'לא ניתן להשלים את ההרשמה. נסה שוב.');
      // Error: Unable to complete registration
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'sender', label: 'שולח' /* Sender */ },
    { value: 'driver', label: 'נהג' /* Driver */ },
    { value: 'both', label: 'שניהם' /* Both */ },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      {/* כותרת */}
      <Text style={styles.title}>הרשמה ל-MOOVIZ</Text>
      <Text style={styles.subtitle}>הצטרף לקהילת המשלוחים</Text>
      {/* Join the delivery community */}

      {/* Full name */}
      {/* שם מלא */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>שם מלא</Text>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(v) => updateField('fullName', v)}
          placeholder="ישראל ישראלי"
          textAlign="right"
        />
        {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
      </View>

      {/* Phone */}
      {/* טלפון */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>מספר טלפון</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(v) => updateField('phone', v)}
          placeholder="+972501234567"
          keyboardType="phone-pad"
          textAlign="right"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      {/* Email */}
      {/* אימייל */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>אימייל</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(v) => updateField('email', v)}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          textAlign="right"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      {/* City */}
      {/* עיר */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>עיר</Text>
        <TextInput
          style={styles.input}
          value={form.city}
          onChangeText={(v) => updateField('city', v)}
          placeholder="תל אביב"
          textAlign="right"
        />
        {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
      </View>

      {/* Role selection */}
      {/* בחירת תפקיד */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>תפקיד</Text>
        <View style={styles.roleRow}>
          {roleOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.roleChip, form.role === opt.value && styles.roleChipActive]}
              onPress={() => updateField('role', opt.value)}
            >
              <Text
                style={[
                  styles.roleChipText,
                  form.role === opt.value && styles.roleChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Profile photo */}
      {/* תמונת פרופיל */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>תמונת פרופיל</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('profilePhotoUri')}>
          {form.profilePhotoUri ? (
            <Image source={{ uri: form.profilePhotoUri }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.uploadButtonText}>בחר תמונה</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* KYC document — required for drivers */}
      {/* מסמך זיהוי — נדרש לנהגים */}
      {(form.role === 'driver' || form.role === 'both') && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>מסמך זיהוי (תעודת זהות / רישיון נהיגה)</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => pickImage('kycDocumentUri')}
          >
            {form.kycDocumentUri ? (
              <Text style={styles.uploadButtonTextDone}>מסמך הועלה בהצלחה ✓</Text>
            ) : (
              <Text style={styles.uploadButtonText}>העלה מסמך</Text>
            )}
          </TouchableOpacity>
          {errors.kycDocumentUri && <Text style={styles.errorText}>{errors.kycDocumentUri}</Text>}
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? 'נרשם...' : 'הירשם'}
          {/* Registering... / Register */}
        </Text>
      </TouchableOpacity>

      {/* Back to login */}
      {/* חזרה להתחברות */}
      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
        <Text style={styles.backLinkText}>כבר רשום? התחבר</Text>
        {/* Already registered? Log in */}
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 48,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
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
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'right',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  roleChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  uploadButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  uploadButtonTextDone: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  backLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
