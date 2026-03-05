import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { validatePhone } from '../../utils/validators';
import { sendPhoneOTP, mapFirebaseAuthError } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'AddPhone'>;

/**
 * AddPhoneScreen -- for migrated users who need to add phone number
 */
export function AddPhoneScreen({ navigation }: Props): React.JSX.Element {
  const [phone, setPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async (): Promise<void> => {
    setError(null);

    if (!validatePhone(phone)) {
      setError('מספר טלפון לא תקין');
      return;
    }

    try {
      setIsLoading(true);
      const verificationId = await sendPhoneOTP(phone);
      navigation.navigate('OTPVerification', {
        phoneNumber: phone,
        verificationId,
        mode: 'addPhone',
      });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError('שגיאה בשליחת קוד אימות');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = (): void => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>הוספת מספר טלפון</Text>
        <Text style={styles.subtitle}>
          הוסף מספר טלפון לחשבון שלך לאימות נוסף
        </Text>

        <View style={styles.inputSection}>
          <Text style={styles.label}>מספר טלפון</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="050-1234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textAlign={I18nManager.isRTL ? 'right' : 'left'}
            editable={!isLoading}
          />
          <Text style={styles.hint}>פורמט ישראלי: 050-1234567 או +972501234567</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={isLoading || !phone.trim()}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'שולח...' : 'שלח קוד אימות'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip option */}
        <TouchableOpacity style={styles.skipLink} onPress={handleSkip}>
          <Text style={styles.skipLinkText}>דלג לעת עתה</Text>
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
  hint: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 4,
    textAlign: 'right',
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
  skipLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  skipLinkText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
