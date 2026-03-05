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
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { validatePhone } from '../../utils/validators';
import { sendPhoneOTP, mapFirebaseAuthError } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'AddPhone'>;

/**
 * AddPhoneScreen -- for migrated users who need to add phone number
 */
export function AddPhoneScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [phone, setPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async (): Promise<void> => {
    setError(null);

    if (!validatePhone(phone)) {
      setError(t('auth.invalidPhone'));
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
        setError(t('auth.otpError'));
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
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('auth.addPhone')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('auth.addPhoneSubtitle')}
        </Text>

        <View style={styles.inputSection}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.phone')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="050-1234567"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            autoComplete="tel"
            textAlign={I18nManager.isRTL ? 'right' : 'left'}
            editable={!isLoading}
          />
          <Text style={[styles.hint, { color: colors.textTertiary }]}>{t('auth.phoneHint')}</Text>

          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, isLoading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={isLoading || !phone.trim()}
          >
            <Text style={styles.buttonText}>
              {isLoading ? t('auth.sending') : t('auth.sendOtp')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip option */}
        <TouchableOpacity style={styles.skipLink} onPress={handleSkip}>
          <Text style={[styles.skipLinkText, { color: colors.textSecondary }]}>{t('auth.skipForNow')}</Text>
        </TouchableOpacity>
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
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
  },
  button: {
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
    fontWeight: '600',
  },
});
