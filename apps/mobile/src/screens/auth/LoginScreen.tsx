import React, { useState } from 'react';
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
import { validatePhone, validateEmail } from '../../utils/validators';
import { sendOTP } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/**
 * LoginScreen — מסך התחברות
 * Phone number or email input with OTP trigger.
 * שדה מספר טלפון / אימייל ושליחת קוד אימות
 */
export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const [phoneOrEmail, setPhoneOrEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async (): Promise<void> => {
    setError(null);

    // Validate input — phone (E.164) or email
    const isPhone = phoneOrEmail.startsWith('+') || /^\d/.test(phoneOrEmail);
    if (isPhone && !validatePhone(phoneOrEmail)) {
      setError('מספר טלפון לא תקין'); // Invalid phone number
      return;
    }
    if (!isPhone && !validateEmail(phoneOrEmail)) {
      setError('כתובת אימייל לא תקינה'); // Invalid email
      return;
    }

    try {
      setIsLoading(true);
      const verificationId = await sendOTP(phoneOrEmail);
      navigation.navigate('OTPVerification', {
        phoneNumber: phoneOrEmail,
        verificationId,
      });
    } catch (err) {
      setError('שגיאה בשליחת קוד אימות. נסה שוב.'); // Error sending OTP
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo / Brand section */}
        {/* סקשן לוגו / מותג */}
        <View style={styles.brandSection}>
          <Text style={styles.brandTitle}>MOOVIZ</Text>
          <Text style={styles.brandSubtitle}>
            משלוחים קהילתיים — פשוט, מהיר, אמין
          </Text>
          {/* Community deliveries — simple, fast, reliable */}
        </View>

        {/* Input section */}
        {/* סקשן קלט */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>טלפון או אימייל</Text>
          {/* Phone or Email */}
          <TextInput
            style={styles.input}
            value={phoneOrEmail}
            onChangeText={setPhoneOrEmail}
            placeholder="050-1234567 או email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="right"
            editable={!isLoading}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={isLoading || !phoneOrEmail.trim()}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'שולח...' : 'שלח קוד אימות'}
              {/* Sending... / Send verification code */}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Register link */}
        {/* קישור להרשמה */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            עדיין לא רשום? <Text style={styles.registerTextBold}>הירשם עכשיו</Text>
          </Text>
          {/* Not registered? Register now */}
        </TouchableOpacity>
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
  brandSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  registerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  registerTextBold: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
