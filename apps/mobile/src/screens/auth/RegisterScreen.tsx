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
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { validatePhone, validateEmail, validateRequired } from '../../utils/validators';
import firestore from '@react-native-firebase/firestore';
import { registerWithEmail, signInWithEmail, createUserDocument, mapFirebaseAuthError } from '../../services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CarAlert, useCarAlert } from '../../components/CarAlert';
import { LoadingOverlay } from '../../components/LoadingOverlay';

/** Key used to pass registration data to useAuth auto-create (avoids race condition) */
export const PENDING_REGISTRATION_KEY = '@pending_registration';

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
  const [showPasswordFields, setShowPasswordFields] = useState<Record<string, boolean>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

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
    if (!acceptedTerms) {
      setTermsError(t('auth.termsRequired'));
      return;
    }
    setTermsError(null);

    try {
      setIsLoading(true);
      setLoadingStep(0);
      setLoadingVisible(true);

      // Save registration data BEFORE creating Auth user — useAuth auto-create reads this
      // to avoid race condition (onAuthStateChanged fires before createUserDocument)
      await AsyncStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
      }));

      const credential = await registerWithEmail(form.email, form.password);

      // Try to create user doc — if it fails, the auto-create in useAuth will handle it
      try {
        await createUserDocument(credential.user.uid, {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
        });
      } catch (docErr) {
        // Firestore doc creation failed — write directly as fallback
        console.warn('[RegisterScreen] createUserDocument failed, writing directly:', docErr);
        const firestore = require('@react-native-firebase/firestore').default;
        const { normalizePhoneNumber } = require('../../services/auth');
        await firestore().collection('users').doc(credential.user.uid).set({
          uid: credential.user.uid,
          fullName: form.fullName,
          email: form.email,
          phone: normalizePhoneNumber(form.phone),
          city: '',
          role: 'sender',
          driverUnlocked: false,
          driverAvailable: false,
          kycStatus: 'pending',
          fcmTokens: [],
          location: { lat: 0, lng: 0, geohash: '' },
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }).catch(() => {}); // Last resort — useAuth auto-create will catch this
      }

      setLoadingStep(1);
      await new Promise(r => setTimeout(r, 600));
      setLoadingVisible(false);

      navigation.navigate('OTPVerification', {
        phoneNumber: form.phone,
        verificationId: '',
        mode: 'register',
      });
    } catch (err: unknown) {
      setLoadingVisible(false);
      const firebaseError = err as { code?: string };

      if (firebaseError.code === 'auth/email-already-in-use') {
        // Auth record exists but Firestore doc may have been deleted (partial account deletion).
        // Try signing in — if successful and no doc, allow re-registration.
        try {
          const existingCred = await signInWithEmail(form.email, form.password);
          const docSnap = await firestore().collection('users').doc(existingCred.user.uid).get();
          if (!docSnap.exists) {
            await createUserDocument(existingCred.user.uid, {
              fullName: form.fullName,
              email: form.email,
              phone: form.phone,
            });
            setLoadingStep(1);
            await new Promise(r => setTimeout(r, 600));
            setLoadingVisible(false);
            navigation.navigate('OTPVerification', {
              phoneNumber: form.phone,
              verificationId: '',
              mode: 'register',
            });
            return;
          } else {
            // Full account exists — direct to login
            carAlert.show('error', t('auth.registerError'), 'חשבון קיים עם כתובת זו — אנא התחבר');
          }
        } catch (_signInErr) {
          carAlert.show('error', t('auth.registerError'), mapFirebaseAuthError(firebaseError.code));
        }
      } else if (firebaseError.code) {
        carAlert.show('error', t('auth.registerError'), mapFirebaseAuthError(firebaseError.code));
      } else {
        carAlert.show('error', t('auth.registerError'), t('auth.registerError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswordFields((prev) => ({ ...prev, [field]: !prev[field] }));
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
  ) => {
    const isPassword = options?.secureTextEntry === true;
    const isHidden = isPassword && !showPasswordFields[field];
    return (
      <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg }, focusedField === field && { borderColor: colors.primary, borderWidth: 1.5, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }]}>
        <TextInput
          ref={options?.ref}
          style={[styles.input, { color: colors.textPrimary }, isPassword && { paddingEnd: 48 }]}
          value={form[field]}
          onChangeText={(v) => updateField(field, v)}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={isHidden}
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
        {isPassword && (
          <TouchableOpacity
            style={styles.eyeToggle}
            onPress={() => togglePasswordVisibility(field)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.eyeIcon}>
              {showPasswordFields[field] ? '👁' : '👁‍🗨'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const scrollRef = useRef<ScrollView>(null);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        {(focusedField === 'password' || form.password.length > 0) && (
          <View style={styles.reqList}>
            {([
              { test: form.password.length >= 8, label: t('auth.reqMinLength') },
              { test: /[A-Z]/.test(form.password), label: t('auth.reqUppercase') },
              { test: /[a-z]/.test(form.password), label: t('auth.reqLowercase') },
              { test: /[0-9]/.test(form.password), label: t('auth.reqNumber') },
              { test: /[!@#$%^&*(),.?":{}|<>]/.test(form.password), label: t('auth.reqSpecial') },
            ] as const).map((req) => (
              <Text key={req.label} style={[styles.reqItem, { color: req.test ? '#4CAF50' : colors.textTertiary }]}>
                {req.test ? '✓' : '✗'} {req.label}
              </Text>
            ))}
          </View>
        )}
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
        })}
        {errors.phone && <Text style={[styles.errorText, { color: colors.error }]}>{errors.phone}</Text>}
      </View>

      {/* Terms of Service */}
      <View style={styles.fieldGroup}>
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => { setAcceptedTerms(!acceptedTerms); setTermsError(null); }}
          activeOpacity={0.7}
        >
          <View style={[
            styles.checkbox,
            { borderColor: colors.border, backgroundColor: colors.inputBg },
            acceptedTerms && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}>
            {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.termsText, { color: colors.textSecondary }]}>
            {t('auth.acceptTerms')}{' '}
            <Text
              style={{ color: colors.primary, fontWeight: '700' }}
              onPress={() => Linking.openURL('https://admin.mooviz.co.il/terms')}
            >
              {t('auth.termsOfService')}
            </Text>
            {' '}{t('common.and') || 'ו'}{' '}
            <Text
              style={{ color: colors.primary, fontWeight: '700' }}
              onPress={() => Linking.openURL('https://admin.mooviz.co.il/privacy')}
            >
              {t('terms.privacyPolicy')}
            </Text>
          </Text>
        </TouchableOpacity>
        {termsError && <Text style={[styles.errorText, { color: colors.error }]}>{termsError}</Text>}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: colors.primary, shadowColor: colors.primary }, (isLoading || !acceptedTerms) && styles.submitButtonDisabled]}
        onPress={handleRegister}
        disabled={isLoading || !acceptedTerms}
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
    <LoadingOverlay
      visible={loadingVisible}
      steps={['registering', 'almostDone']}
      currentStep={loadingStep}
      timeout={60000}
      onTimeout={() => setLoadingVisible(false)}
      onCancel={() => setLoadingVisible(false)}
    />
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 14,
    flex: 1,
  },
  eyeToggle: {
    position: 'absolute',
    end: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  eyeIcon: {
    fontSize: 20,
  },
  reqList: {
    marginTop: 6,
    gap: 2,
  },
  reqItem: {
    fontSize: 12,
    fontWeight: '500',
  },
});
