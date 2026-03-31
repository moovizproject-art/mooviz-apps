import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { sendPhoneOTP, verifyAndLinkPhone, mapFirebaseAuthError } from '../../services/auth';
import { VerificationStepper } from '../../components/VerificationStepper';
import { CarAlert, useCarAlert } from '../../components/CarAlert';

const logo = require('../../assets/logo.png');

type Props = NativeStackScreenProps<any, any>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 120; // 2 minutes — reduces Firebase rate-limit triggers

/**
 * OTPScreen -- 6-digit OTP verification for phone linking
 */
export function OTPScreen({ route, navigation }: Props): React.JSX.Element {
  const { phoneNumber } = route.params ?? {};
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { refreshFirebaseUser, refreshUserDoc, setForceOtp } = useAuth();

  const [code, setCode] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [verificationId, setVerificationId] = useState<string>(route.params?.verificationId || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(RESEND_COOLDOWN_SECONDS);
  const [resendCount, setResendCount] = useState<number>(0);
  const MAX_RESENDS = 5;
  const carAlert = useCarAlert();

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hiddenInputRef = useRef<TextInput | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [useHiddenInput, setUseHiddenInput] = useState<boolean>(true);

  // Scale animation for each digit box
  const scaleAnims = useRef(
    Array.from({ length: OTP_LENGTH }, () => new Animated.Value(1)),
  ).current;

  // Pop animation when a digit box gets focus
  const animateFocus = useCallback((index: number) => {
    setFocusedIndex(index);
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 1.15,
        duration: 150,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[index], {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnims]);

  // Settle animation when a digit is filled
  const animateSettle = useCallback((index: number) => {
    Animated.spring(scaleAnims[index], {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  }, [scaleAnims]);

  const sendOTP = useCallback(async (isResend = false): Promise<void> => {
    if (isResend && resendCount >= MAX_RESENDS) {
      setError('הגעת למספר המקסימלי של שליחות חוזרות. אנא המתן 15 דקות ונסה שוב.');
      return;
    }
    try {
      setIsSending(true);
      setError(null);
      const vId = await sendPhoneOTP(phoneNumber);
      setVerificationId(vId);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      if (isResend) setResendCount((c) => c + 1);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError(firebaseError.message || t('auth.otpError'));
      }
    } finally {
      setIsSending(false);
    }
  }, [phoneNumber, t, resendCount]);

  useEffect(() => {
    if (!verificationId) {
      sendOTP();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Hidden input captures paste + iOS autofill, then distributes to visual boxes
  const handleHiddenInput = (text: string): void => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    if (!digits) return;
    const newCode = new Array(OTP_LENGTH).fill('');
    digits.split('').forEach((d, i) => {
      newCode[i] = d;
      animateSettle(i);
    });
    setCode(newCode);
    setError(null);
    if (newCode.every((d) => d.length === 1)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleDigitChange = (text: string, index: number): void => {
    const digits = text.replace(/[^0-9]/g, '');

    // Handle paste: if multiple digits received, distribute across fields
    if (digits.length > 1) {
      handleHiddenInput(digits);
      return;
    }

    // Switch to per-box mode once user types manually
    setUseHiddenInput(false);

    const digit = digits;
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    if (digit) {
      // Settle current box
      animateSettle(index);
      // Move to next and pop it
      if (index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
        animateFocus(index + 1);
      }
    }

    if (newCode.every((d) => d.length === 1)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number): void => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string): Promise<void> => {
    const fullCode = otpCode || code.join('');
    if (fullCode.length !== OTP_LENGTH) {
      setError(t('auth.invalidCode'));
      return;
    }

    if (!verificationId) {
      setError(t('auth.noVerificationId'));
      return;
    }

    try {
      setIsVerifying(true);
      await verifyAndLinkPhone(verificationId, fullCode);
      console.log('[OTPScreen] Phone verified successfully');
      // Stamp lastOtpAt so 30-day auto-login skips OTP
      const uid = auth().currentUser?.uid;
      if (uid) {
        await firestore().collection('users').doc(uid).update({
          lastOtpAt: firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      // Clear forceOtp BEFORE refreshing — prevents re-render loop
      // (refreshUserDoc triggers navigator re-render; if forceOtp is still true,
      // navigator shows PhoneVerification again before alert is visible)
      setForceOtp(false);
      await refreshFirebaseUser();
      await refreshUserDoc();
      carAlert.show('success', t('common.success'), t('auth.phoneVerified'));
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError(firebaseError.message || t('auth.wrongCode'));
      }
      // Don't clear code on credential-already-in-use — the code was correct,
      // just the phone is taken. Clearing would confuse the user.
      if (firebaseError.code !== 'auth/credential-already-in-use') {
        setCode(new Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Blue header */}
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 16 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <View style={styles.backChevron} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => auth().signOut()}>
            <Text style={styles.cancelText}>{t('auth.backToLogin')}</Text>
          </TouchableOpacity>
          <View style={styles.logoCircle}>
            <Image source={logo} style={[styles.logoImage, { tintColor: '#FFFFFF' }]} resizeMode="contain" />
          </View>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            {t('auth.phoneVerification')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.headerTextSecondary }]}>
            {isSending
              ? t('auth.codeSending')
              : t('auth.codeSent', { phone: phoneNumber })}
          </Text>
        </View>

        {/* OTP form */}
        <View style={styles.formSection}>
          {/* Single OTP input — avoids RTL digit-box issues */}
          <TextInput
            ref={hiddenInputRef}
            style={[
              styles.otpSingleInput,
              {
                borderColor: error ? colors.error : colors.primary,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
              },
            ]}
            value={code.join('')}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
              const newCode = new Array(OTP_LENGTH).fill('');
              digits.split('').forEach((d, i) => { newCode[i] = d; });
              setCode(newCode);
              setError(null);
              if (newCode.every((d) => d.length === 1)) {
                handleVerify(newCode.join(''));
              }
            }}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            textAlign="center"
            textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : undefined}
            placeholder="000000"
            placeholderTextColor={colors.textTertiary}
            autoFocus
            editable={!isVerifying && !isSending}
          />

          {error && (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.verifyButton, { backgroundColor: colors.primary }, isVerifying && styles.verifyButtonDisabled]}
            onPress={() => handleVerify()}
            disabled={isVerifying || isSending || code.some((d) => !d)}
            activeOpacity={0.85}
          >
            {isVerifying ? (
              <View style={styles.buttonLoadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={[styles.verifyButtonText, { marginLeft: 10 }]}>{t('auth.verifying')}</Text>
              </View>
            ) : (
              <Text style={styles.verifyButtonText}>{t('auth.verify')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendSection}>
            {resendTimer > 0 ? (
              <Text style={[styles.resendTimer, { color: colors.textSecondary }]}>
                {t('auth.resendIn', { seconds: resendTimer })}
              </Text>
            ) : resendCount >= MAX_RESENDS ? (
              <Text style={[styles.resendTimer, { color: colors.error }]}>
                הגעת למספר המקסימלי של שליחות. המתן 15 דקות.
              </Text>
            ) : (
              <TouchableOpacity onPress={() => sendOTP(true)} disabled={isSending}>
                <Text style={[styles.resendLink, { color: colors.primary }]}>
                  {t('auth.resendCode')} ({MAX_RESENDS - resendCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Step indicator with car */}
        <VerificationStepper currentStep={1} />
      </ScrollView>

      <CarAlert
        visible={carAlert.visible}
        type={carAlert.type}
        title={carAlert.title}
        message={carAlert.message}
        buttons={carAlert.buttons}
        onDismiss={carAlert.dismiss}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backChevron: {
    width: 11,
    height: 11,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    marginRight: -3,
  },
  cancelButton: {
    position: 'absolute',
    top: 22,
    right: 16,
    zIndex: 10,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 100,
    height: 50,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
  },
  otpSingleInput: {
    height: 60,
    borderWidth: 2,
    borderRadius: 16,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 16,
    paddingHorizontal: 24,
    direction: 'ltr',
    writingDirection: 'ltr',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  verifyButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  resendTimer: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
