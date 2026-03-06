import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { validatePhone, validateEmail, validateRequired } from '../../utils/validators';
import { registerWithEmail, createUserDocument, mapFirebaseAuthError } from '../../services/auth';
import { CarAlert, useCarAlert } from '../../components/CarAlert';

const logo = require('../../assets/logo.png');

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
  const { colors } = useTheme();
  const { t } = useI18n();
  const carAlert = useCarAlert();
  const [form, setForm] = useState<RegisterForm>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [focusedField, setFocusedField] = useState<FormField | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const updateField = (key: FormField, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<FormField, string>> = {};

    if (!validateRequired(form.fullName)) {
      newErrors.fullName = t('auth.fullNameRequired');
    }
    if (!validateEmail(form.email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    if (!form.password || form.password.length < 8) {
      newErrors.password = t('auth.passwordTooShort');
    }
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }
    if (!validatePhone(form.phone)) {
      newErrors.phone = t('auth.invalidPhone');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (): Promise<void> => {
    if (!validate()) return;

    try {
      setIsLoading(true);

      const credential = await registerWithEmail(form.email, form.password);

      await createUserDocument(credential.user.uid, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
      });

      navigation.navigate('OTPVerification', {
        phoneNumber: form.phone,
        verificationId: '',
        mode: 'register',
      });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        carAlert.show('error', t('auth.registerError'), mapFirebaseAuthError(firebaseError.code));
      } else {
        carAlert.show('error', t('auth.registerError'), t('auth.registerError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    field: FormField,
    placeholder: string,
    options?: {
      secureTextEntry?: boolean;
      keyboardType?: 'email-address' | 'phone-pad' | 'default';
      autoComplete?: string;
      autoCapitalize?: 'none' | 'sentences';
      ref?: React.RefObject<TextInput>;
      nextRef?: React.RefObject<TextInput>;
      returnKeyType?: 'next' | 'done';
      onSubmitEditing?: () => void;
    },
  ) => (
    <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg }, focusedField === field && { borderColor: colors.primary, borderWidth: 1.5, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }]}>
      <TextInput
        ref={options?.ref}
        style={[styles.input, { color: colors.textPrimary }]}
        value={form[field]}
        onChangeText={(v) => updateField(field, v)}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={options?.secureTextEntry}
        keyboardType={options?.keyboardType || 'default'}
        autoCapitalize={options?.autoCapitalize || 'sentences'}
        textAlign="right"
        editable={!isLoading}
        onFocus={() => {
          setFocusedField(field);
        }}
        onBlur={() => setFocusedField(null)}
        returnKeyType={options?.returnKeyType || 'next'}
        onSubmitEditing={options?.onSubmitEditing || (() => options?.nextRef?.current?.focus())}
      />
    </View>
  );

  const scrollRef = useRef<ScrollView>(null);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('auth.registerSubtitle')}</Text>
      </View>

      {/* Full name */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.fullName')}</Text>
        {renderInput('fullName', 'ישראל ישראלי', {
          nextRef: emailRef,
        })}
        {errors.fullName && <Text style={[styles.errorText, { color: colors.error }]}>{errors.fullName}</Text>}
      </View>

      {/* Email */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.email')}</Text>
        {renderInput('email', 'email@example.com', {
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          ref: emailRef,
          nextRef: passwordRef,
        })}
        {errors.email && <Text style={[styles.errorText, { color: colors.error }]}>{errors.email}</Text>}
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.password')}</Text>
        {renderInput('password', t('auth.password'), {
          secureTextEntry: true,
          ref: passwordRef,
          nextRef: confirmRef,
        })}
        {errors.password && <Text style={[styles.errorText, { color: colors.error }]}>{errors.password}</Text>}
      </View>

      {/* Confirm password */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.confirmPassword')}</Text>
        {renderInput('confirmPassword', t('auth.confirmPassword'), {
          secureTextEntry: true,
          ref: confirmRef,
          nextRef: phoneRef,
        })}
        {errors.confirmPassword && <Text style={[styles.errorText, { color: colors.error }]}>{errors.confirmPassword}</Text>}
      </View>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.phone')}</Text>
        {renderInput('phone', '050-1234567', {
          keyboardType: 'phone-pad',
          ref: phoneRef,
          returnKeyType: 'done',
          onSubmitEditing: handleRegister,
        })}
        {errors.phone && <Text style={[styles.errorText, { color: colors.error }]}>{errors.phone}</Text>}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: colors.primary, shadowColor: colors.primary }, isLoading && styles.submitButtonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? t('auth.registering') : t('auth.register')}
        </Text>
      </TouchableOpacity>

      {/* Back to login */}
      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
        <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>
          {t('auth.alreadyRegistered')} <Text style={[styles.backLinkBold, { color: colors.primary }]}>{t('auth.loginNow')}</Text>
        </Text>
      </TouchableOpacity>

      <View style={styles.keyboardSpacer} />
    </ScrollView>
    <CarAlert visible={carAlert.visible} type={carAlert.type} title={carAlert.title} message={carAlert.message} buttons={carAlert.buttons} onDismiss={carAlert.dismiss} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 50,
    marginBottom: 32,
  },
  logo: {
    width: 200,
    height: 70,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    writingDirection: 'rtl',
  },
  errorText: {
    fontSize: 13,
    marginTop: 4,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  backLinkText: {
    fontSize: 14,
  },
  backLinkBold: {
    fontWeight: '700',
  },
  keyboardSpacer: {
    height: 120,
  },
});
