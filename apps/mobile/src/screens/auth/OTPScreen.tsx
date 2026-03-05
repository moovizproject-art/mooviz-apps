import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { sendPhoneOTP, verifyAndLinkPhone, mapFirebaseAuthError } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTPVerification'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * OTPScreen -- 6-digit OTP verification for phone linking
 */
export function OTPScreen({ route, navigation }: Props): React.JSX.Element {
  const { phoneNumber, mode } = route.params;
  const { colors } = useTheme();
  const { t } = useI18n();

  const [code, setCode] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [verificationId, setVerificationId] = useState<string>(route.params.verificationId || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(RESEND_COOLDOWN_SECONDS);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-send OTP on mount if no verificationId was passed
  const sendOTP = useCallback(async (): Promise<void> => {
    try {
      setIsSending(true);
      setError(null);
      const vId = await sendPhoneOTP(phoneNumber);
      setVerificationId(vId);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === 'auth/operation-not-allowed') {
        setError(t('auth.smsNotEnabled'));
      } else if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError(t('auth.otpError'));
      }
    } finally {
      setIsSending(false);
    }
  }, [phoneNumber, t]);

  useEffect(() => {
    if (!verificationId) {
      sendOTP();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleDigitChange = (text: string, index: number): void => {
    const digit = text.replace(/[^0-9]/g, '');
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (newCode.every((d) => d.length === 1)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number): void => {
    // Handle backspace -- move to previous input
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
      // Phone is now linked to the account
      // Auth state listener in useAuth will pick up the change
      if (mode === 'addPhone') {
        Alert.alert(t('common.success'), t('auth.phoneVerified'), [
          { text: t('common.confirm'), onPress: () => navigation.goBack() },
        ]);
      }
      // For register/login mode, the auth listener handles navigation
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError(t('auth.wrongCode'));
      }
      setCode(new Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    await sendOTP();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('auth.phoneVerification')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isSending
            ? t('auth.codeSending')
            : t('auth.codeSent', { phone: phoneNumber })}
        </Text>

        {/* OTP digit inputs — wrapped in LTR to prevent RTL reversal */}
        <View style={{ direction: 'ltr' }}>
          <View style={styles.otpRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.otpInput,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface },
                  digit ? { borderColor: colors.primary } : null,
                  error ? { borderColor: colors.error } : null,
                ]}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
                selectTextOnFocus
                editable={!isVerifying && !isSending}
              />
            ))}
          </View>
        </View>

        {/* Error message */}
        {error && (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        )}

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyButton, { backgroundColor: colors.primary }, isVerifying && styles.verifyButtonDisabled]}
          onPress={() => handleVerify()}
          disabled={isVerifying || isSending || code.some((d) => !d)}
        >
          <Text style={styles.verifyButtonText}>
            {isVerifying ? t('auth.verifying') : t('auth.verify')}
          </Text>
        </TouchableOpacity>

        {/* Resend code */}
        <View style={styles.resendSection}>
          {resendTimer > 0 ? (
            <Text style={[styles.resendTimer, { color: colors.textSecondary }]}>
              {t('auth.resendIn', { seconds: resendTimer })}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={isSending}>
              <Text style={[styles.resendLink, { color: colors.primary }]}>
                {t('auth.resendCode')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Skip in dev when phone auth is not enabled */}
        {error && error.includes(t('auth.smsNotEnabled').substring(0, 5)) && __DEV__ && (
          <TouchableOpacity
            style={[styles.skipButton, { borderColor: colors.accent }]}
            onPress={() => navigation.getParent()?.reset({
              index: 0,
              routes: [{ name: 'SenderTabs' as never }],
            })}
          >
            <Text style={[styles.skipButtonText, { color: colors.accent }]}>
              {t('auth.skipDev')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
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
  skipButton: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
