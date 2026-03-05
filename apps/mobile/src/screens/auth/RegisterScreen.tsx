import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  I18nManager,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { validatePhone, validateEmail, validateRequired } from '../../utils/validators';
import { registerWithEmail, createUserDocument, mapFirebaseAuthError } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface RegisterForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

type FormField = keyof RegisterForm;

/**
 * RegisterScreen -- email+password registration with profile data
 */
export function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const [form, setForm] = useState<RegisterForm>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});

  const updateField = (key: FormField, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<FormField, string>> = {};

    if (!validateRequired(form.fullName)) {
      newErrors.fullName = 'שם מלא נדרש';
    }
    if (!validateEmail(form.email)) {
      newErrors.email = 'כתובת אימייל לא תקינה';
    }
    if (!form.password || form.password.length < 8) {
      newErrors.password = 'סיסמה חייבת להכיל לפחות 8 תווים';
    }
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות אינן תואמות';
    }
    if (!validatePhone(form.phone)) {
      newErrors.phone = 'מספר טלפון לא תקין';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (): Promise<void> => {
    if (!validate()) return;

    try {
      setIsLoading(true);

      // Step 1: Create Firebase Auth account
      const credential = await registerWithEmail(form.email, form.password);

      // Step 2: Create Firestore user document
      await createUserDocument(credential.user.uid, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
      });

      // Step 3: Navigate to OTP for phone verification
      navigation.navigate('OTPVerification', {
        phoneNumber: form.phone,
        verificationId: '', // Will be sent on OTP screen mount
        mode: 'register',
      });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        Alert.alert('שגיאה', mapFirebaseAuthError(firebaseError.code));
      } else {
        Alert.alert('שגיאה', 'לא ניתן להשלים את ההרשמה. נסה שוב.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const textAlign = I18nManager.isRTL ? 'right' as const : 'left' as const;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <Text style={styles.title}>הרשמה ל-MOOVIZ</Text>
      <Text style={styles.subtitle}>הצטרף לקהילת המשלוחים</Text>

      {/* Full name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>שם מלא</Text>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(v) => updateField('fullName', v)}
          placeholder="ישראל ישראלי"
          textAlign={textAlign}
          editable={!isLoading}
        />
        {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
      </View>

      {/* Email */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>אימייל</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(v) => updateField('email', v)}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textAlign={textAlign}
          editable={!isLoading}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>סיסמה</Text>
        <TextInput
          style={styles.input}
          value={form.password}
          onChangeText={(v) => updateField('password', v)}
          placeholder="לפחות 8 תווים"
          secureTextEntry
          autoComplete="password-new"
          textAlign={textAlign}
          editable={!isLoading}
        />
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>

      {/* Confirm password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>אימות סיסמה</Text>
        <TextInput
          style={styles.input}
          value={form.confirmPassword}
          onChangeText={(v) => updateField('confirmPassword', v)}
          placeholder="הזן סיסמה שוב"
          secureTextEntry
          textAlign={textAlign}
          editable={!isLoading}
        />
        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
      </View>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>מספר טלפון</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(v) => updateField('phone', v)}
          placeholder="050-1234567"
          keyboardType="phone-pad"
          autoComplete="tel"
          textAlign={textAlign}
          editable={!isLoading}
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? 'נרשם...' : 'הירשם'}
        </Text>
      </TouchableOpacity>

      {/* Back to login */}
      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
        <Text style={styles.backLinkText}>כבר רשום? התחבר</Text>
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
