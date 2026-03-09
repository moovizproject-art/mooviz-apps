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
import { validateEmail } from '../../utils/validators';
import { sendPasswordReset, mapFirebaseAuthError } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/**
 * ForgotPasswordScreen -- send password reset email
 */
export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleReset = async (): Promise<void> => {
    setError(null);
    setSuccess(false);

    if (!validateEmail(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }

    try {
      setIsLoading(true);
      await sendPasswordReset(email);
      setSuccess(true);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError(t('auth.loginError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('auth.resetPassword')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('auth.resetSubtitle')}
        </Text>

        {success ? (
          <View style={styles.successSection}>
            <Text style={[styles.successText, { color: colors.success }]}>
              {t('auth.resetSent')}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.buttonText}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputSection}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.email')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textAlign="right"
              editable={!isLoading}
            />

            {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, isLoading && styles.buttonDisabled]}
              onPress={handleReset}
              disabled={isLoading || !email.trim()}
            >
              <Text style={styles.buttonText}>
                {isLoading ? t('auth.sending') : t('auth.sendResetLink')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[styles.backLinkText, { color: colors.primary }]}>{t('auth.backToLogin')}</Text>
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
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  successSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
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
  backLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
