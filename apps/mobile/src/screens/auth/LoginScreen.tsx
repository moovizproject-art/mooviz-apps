import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { validateEmail } from '../../utils/validators';
import { signInWithEmail, mapFirebaseAuthError } from '../../services/auth';

const logo = require('../../assets/logo.png');
const carImage = require('../../assets/car.png');

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/**
 * LoginScreen -- email+password login
 */
export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const { width: screenWidth } = useWindowDimensions();
  const truckX = useRef(new Animated.Value(screenWidth)).current;
  const truckBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    truckX.setValue(screenWidth);
    const drive = Animated.loop(
      Animated.sequence([
        Animated.timing(truckX, {
          toValue: -60,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(truckX, {
          toValue: screenWidth,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(truckBounce, {
          toValue: -3,
          duration: 120,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(truckBounce, {
          toValue: 0,
          duration: 120,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    drive.start();
    bounce.start();
    return () => { drive.stop(); bounce.stop(); };
  }, [truckX, truckBounce, screenWidth]);

  const handleLogin = async (): Promise<void> => {
    setError(null);

    if (!validateEmail(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }

    if (!password || password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    try {
      setIsLoading(true);
      await signInWithEmail(email, password);
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand section */}
        <View style={styles.brandSection}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
            {t('auth.brandSubtitle')}
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Animated truck — drives right-to-left for Hebrew RTL */}
        <View style={styles.truckTrack}>
          <Animated.View
            style={[
              styles.truckWrap,
              { left: truckX, top: truckBounce },
            ]}
          >
            <Image
              source={carImage}
              style={styles.truckImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <View style={styles.spacer} />

        {/* Input section */}
        <View style={styles.inputSection}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.email')}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }, emailFocused && { borderColor: colors.primary, borderWidth: 1.5, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textAlign="right"
              editable={!isLoading}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <Text style={[styles.label, styles.labelSpacing, { color: colors.textPrimary }]}>{t('auth.password')}</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }, passwordFocused && { borderColor: colors.primary, borderWidth: 1.5, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }]}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, { color: colors.textPrimary }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoComplete="password"
              textAlign="right"
              editable={!isLoading}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || !email.trim() || !password}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {isLoading ? t('auth.loggingIn') : t('auth.login')}
            </Text>
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={[styles.forgotLinkText, { color: colors.primary }]}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
        </View>

        {/* Language toggle */}
        <View style={styles.langRow}>
          <TouchableOpacity onPress={() => setLocale('en')}>
            <Text style={[styles.langText, { color: colors.textTertiary }, locale === 'en' && { color: colors.primary, fontWeight: '700' }]}>
              EN
            </Text>
          </TouchableOpacity>
          <Text style={[styles.langDivider, { color: colors.textTertiary }]}>|</Text>
          <TouchableOpacity onPress={() => setLocale('he')}>
            <Text style={[styles.langText, { color: colors.textTertiary }, locale === 'he' && { color: colors.primary, fontWeight: '700' }]}>
              עב
            </Text>
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={[styles.registerText, { color: colors.textSecondary }]}>
            {t('auth.noAccount')} <Text style={[styles.registerTextBold, { color: colors.primary }]}>{t('auth.registerNow')}</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  brandSection: {
    alignItems: 'center',
  },
  truckTrack: {
    height: 50,
    overflow: 'hidden',
    marginVertical: 8,
    marginHorizontal: -28,
  },
  truckWrap: {
    position: 'absolute',
  },
  truckImage: {
    width: 45,
    height: 45,
    transform: [{ scaleX: -1 }],
  },
  spacer: {
    flex: 1,
  },
  logo: {
    width: 280,
    height: 140,
    marginBottom: 8,
  },
  brandSubtitle: {
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    alignSelf: 'flex-start',
    textAlign: 'right',
  },
  labelSpacing: {
    marginTop: 16,
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
    paddingVertical: 14,
    fontSize: 16,
    writingDirection: 'rtl',
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  forgotLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  langText: {
    fontSize: 15,
  },
  langDivider: {
    fontSize: 15,
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
  },
  registerTextBold: {
    fontWeight: '700',
  },
});
