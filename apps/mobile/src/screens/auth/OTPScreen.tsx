import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { verifyOTP, sendOTP } from '../../services/auth';
import { useAuth } from '../../hooks/useAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTPVerification'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * OTPScreen — מסך אימות קוד
 * 6-digit OTP verification input.
 * הזנת קוד אימות בן 6 ספרות
 */
export function OTPScreen({ route }: Props): React.JSX.Element {
  const { phoneNumber, verificationId } = route.params;
  const { login } = useAuth();

  const [code, setCode] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(RESEND_COOLDOWN_SECONDS);

  const inputRefs = useRef<(TextInput | null)[]>([]);

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
    // Handle backspace — move to previous input
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string): Promise<void> => {
    const fullCode = otpCode || code.join('');
    if (fullCode.length !== OTP_LENGTH) {
      setError('יש להזין קוד בן 6 ספרות'); // Enter 6-digit code
      return;
    }

    try {
      setIsVerifying(true);
      const user = await verifyOTP(verificationId, fullCode);
      await login(user);
    } catch (err) {
      setError('קוד אימות שגוי. נסה שוב.'); // Invalid code, try again
      setCode(new Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    try {
      await sendOTP(phoneNumber);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      setError(null);
    } catch (err) {
      setError('שגיאה בשליחת קוד חדש'); // Error resending code
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        {/* כותרת */}
        <Text style={styles.title}>אימות מספר טלפון</Text>
        {/* Phone number verification */}
        <Text style={styles.subtitle}>
          קוד אימות נשלח ל-{phoneNumber}
        </Text>
        {/* Verification code sent to... */}

        {/* OTP digit inputs */}
        {/* שדות הזנת קוד */}
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
              editable={!isVerifying}
            />
          ))}
        </View>

        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Verify button */}
        {/* כפתור אימות */}
        <TouchableOpacity
          style={[styles.verifyButton, isVerifying && styles.verifyButtonDisabled]}
          onPress={() => handleVerify()}
          disabled={isVerifying || code.some((d) => !d)}
        >
          <Text style={styles.verifyButtonText}>
            {isVerifying ? 'מאמת...' : 'אמת קוד'}
            {/* Verifying... / Verify code */}
          </Text>
        </TouchableOpacity>

        {/* Resend code */}
        {/* שליחת קוד מחדש */}
        <View style={styles.resendSection}>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>
              שליחה חוזרת בעוד {resendTimer} שניות
              {/* Resend in X seconds */}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>שלח קוד חדש</Text>
              {/* Send new code */}
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
