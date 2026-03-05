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
import { COLORS } from '../../constants/colors';
import { sendPhoneOTP, verifyAndLinkPhone, mapFirebaseAuthError } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTPVerification'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * OTPScreen -- 6-digit OTP verification for phone linking
 */
export function OTPScreen({ route, navigation }: Props): React.JSX.Element {
  const { phoneNumber, mode } = route.params;

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
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError('שגיאה בשליחת קוד אימות');
      }
    } finally {
      setIsSending(false);
    }
  }, [phoneNumber]);

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
      setError('יש להזין קוד בן 6 ספרות');
      return;
    }

    if (!verificationId) {
      setError('לא התקבל מזהה אימות. שלח קוד חדש.');
      return;
    }

    try {
      setIsVerifying(true);
      await verifyAndLinkPhone(verificationId, fullCode);
      // Phone is now linked to the account
      // Auth state listener in useAuth will pick up the change
      if (mode === 'addPhone') {
        Alert.alert('הצלחה', 'מספר הטלפון אומת בהצלחה', [
          { text: 'אישור', onPress: () => navigation.goBack() },
        ]);
      }
      // For register/login mode, the auth listener handles navigation
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError('קוד אימות שגוי. נסה שוב.');
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>אימות מספר טלפון</Text>
        <Text style={styles.subtitle}>
          {isSending ? 'שולח קוד אימות...' : `קוד אימות נשלח ל-${phoneNumber}`}
        </Text>

        {/* OTP digit inputs */}
        <View style={styles.otpRow}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
                error ? styles.otpInputError : null,
              ]}
              value={digit}
              onChangeText={(text) => handleDigitChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              editable={!isVerifying && !isSending}
            />
          ))}
        </View>

        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyButton, isVerifying && styles.verifyButtonDisabled]}
          onPress={() => handleVerify()}
          disabled={isVerifying || isSending || code.some((d) => !d)}
        >
          <Text style={styles.verifyButtonText}>
            {isVerifying ? 'מאמת...' : 'אמת קוד'}
          </Text>
        </TouchableOpacity>

        {/* Resend code */}
        <View style={styles.resendSection}>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>
              שליחה חוזרת בעוד {resendTimer} שניות
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={isSending}>
              <Text style={styles.resendLink}>שלח קוד חדש</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
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
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
  },
  otpInputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
