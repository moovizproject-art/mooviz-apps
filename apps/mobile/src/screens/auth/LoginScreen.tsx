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
import { validateEmail } from '../../utils/validators';
import { signInWithEmail, mapFirebaseAuthError } from '../../services/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/**
 * LoginScreen -- email+password login
 */
export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (): Promise<void> => {
    setError(null);

    if (!validateEmail(email)) {
      setError('כתובת אימייל לא תקינה');
      return;
    }

    if (!password || password.length < 8) {
      setError('סיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }

    try {
      setIsLoading(true);
      await signInWithEmail(email, password);
      // Auth state listener in useAuth will handle navigation
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError('שגיאה בהתחברות. נסה שוב.');
      }
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
        <View style={styles.brandSection}>
          <Text style={styles.brandTitle}>MOOVIZ</Text>
          <Text style={styles.brandSubtitle}>
            משלוחים קהילתיים — פשוט, מהיר, אמין
          </Text>
        </View>

        {/* Input section */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>אימייל</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textAlign={I18nManager.isRTL ? 'right' : 'left'}
            editable={!isLoading}
          />

          <Text style={[styles.label, styles.labelSpacing]}>סיסמה</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="סיסמה (לפחות 8 תווים)"
            secureTextEntry
            autoComplete="password"
            textAlign={I18nManager.isRTL ? 'right' : 'left'}
            editable={!isLoading}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || !email.trim() || !password}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'מתחבר...' : 'התחברות'}
            </Text>
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotLinkText}>שכחת סיסמה?</Text>
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            עדיין לא רשום? <Text style={styles.registerTextBold}>הירשם עכשיו</Text>
          </Text>
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
  labelSpacing: {
    marginTop: 16,
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
  forgotLink: {
    alignItems: 'center',
    marginTop: 12,
  },
  forgotLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
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
