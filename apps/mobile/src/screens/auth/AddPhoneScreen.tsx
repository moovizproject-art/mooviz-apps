import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { validatePhone } from '../../utils/validators';
import { sendPhoneOTP, mapFirebaseAuthError } from '../../services/auth';
import { VerificationStepper } from '../../components/VerificationStepper';

const logo = require('../../assets/logo.png');

type Props = NativeStackScreenProps<any, any>;

/**
 * AddPhoneScreen -- phone verification gate (required before app access)
 */
export function AddPhoneScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [phone, setPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const autoSentRef = useRef(false);

  // Auto-send OTP: check Firebase Auth phone first (re-verification), then Firestore (first time)
  useEffect(() => {
    const fbUser = auth().currentUser;
    if (!fbUser || autoSentRef.current) return;
    console.log('[AddPhoneScreen] Mount — uid:', fbUser.uid, 'authPhone:', fbUser.phoneNumber);

    const autoSend = async (phoneNumber: string) => {
      autoSentRef.current = true;
      setPhone(phoneNumber);
      try {
        setIsLoading(true);
        console.log('[AddPhoneScreen] Sending OTP to:', phoneNumber);
        const verificationId = await sendPhoneOTP(phoneNumber);
        console.log('[AddPhoneScreen] Got verificationId:', verificationId?.substring(0, 20) + '...');
        const otpParams = { phoneNumber, verificationId, mode: 'addPhone' as const };
        try { navigation.navigate('PhoneOTP', otpParams); }
        catch { navigation.navigate('OTPVerification', otpParams); }
      } catch (err: unknown) {
        const firebaseError = err as { code?: string; message?: string };
        if (firebaseError.code) {
          setError(mapFirebaseAuthError(firebaseError.code));
        } else {
          setError(firebaseError.message || t('auth.otpError'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    // If phone already linked in Firebase Auth (2FA re-verification)
    if (fbUser.phoneNumber) {
      autoSend(fbUser.phoneNumber);
      return;
    }

    // Otherwise check Firestore for saved phone (first-time linking)
    firestore().collection('users').doc(fbUser.uid).get().then((doc) => {
      const savedPhone = doc.data()?.phone;
      console.log('[AddPhoneScreen] Firestore phone:', savedPhone);
      if (savedPhone && validatePhone(savedPhone)) {
        autoSend(savedPhone);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pulse animation while loading
  useEffect(() => {
    if (!isLoading) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.92, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isLoading, pulseAnim]);

  const handleSendOTP = async (): Promise<void> => {
    setError(null);

    if (!validatePhone(phone)) {
      setError(t('auth.invalidPhone'));
      return;
    }

    try {
      setIsLoading(true);
      const verificationId = await sendPhoneOTP(phone);
      const otpParams = { phoneNumber: phone, verificationId, mode: 'addPhone' as const };
      try {
        navigation.navigate('PhoneOTP', otpParams);
      } catch {
        navigation.navigate('OTPVerification', otpParams);
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code) {
        setError(mapFirebaseAuthError(firebaseError.code));
      } else {
        setError(firebaseError.message || t('auth.otpError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    await auth().signOut();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Blue header */}
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleLogout}>
            <View style={styles.backChevron} />
          </TouchableOpacity>
          <View style={[styles.logoCircle, { backgroundColor: '#FFFFFF' }]}>
            <Image source={logo} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            {t('auth.verifyPhone')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.headerTextSecondary }]}>
            {t('auth.phoneVerificationSubtitle')}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.phone')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="050-1234567"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            autoComplete="tel"
            textAlign="right"
            editable={!isLoading}
          />
          <Text style={[styles.hint, { color: colors.textTertiary }]}>{t('auth.phoneHint')}</Text>

          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, isLoading && styles.buttonLoading]}
              onPress={handleSendOTP}
              disabled={isLoading || !phone.trim()}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={[styles.buttonText, { marginLeft: 10 }]}>{t('auth.sending')}</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>{t('auth.sendOtp')}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Back to login */}
          <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
            <Text style={[styles.logoutText, { color: colors.error }]}>{t('auth.backToLogin')}</Text>
          </TouchableOpacity>
        </View>

        {/* Step indicator with car */}
        <VerificationStepper currentStep={1} />
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
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 50,
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
    paddingHorizontal: 28,
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
    writingDirection: 'rtl',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonLoading: {
    opacity: 0.85,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
