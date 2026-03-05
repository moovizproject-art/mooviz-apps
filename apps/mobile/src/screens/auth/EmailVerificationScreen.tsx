import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import auth from '@react-native-firebase/auth';

import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { VerificationStepper } from '../../components/VerificationStepper';
import { CarAlert, useCarAlert } from '../../components/CarAlert';

const logo = require('../../assets/logo.png');
const RESEND_COOLDOWN = 60;

/**
 * EmailVerificationScreen -- shown after login/register when email is not verified.
 */
export function EmailVerificationScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { refreshFirebaseUser } = useAuth();
  const [resendTimer, setResendTimer] = useState(0);
  const [checking, setChecking] = useState(false);
  const alert = useCarAlert();

  // Send verification email on mount
  useEffect(() => {
    const user = auth().currentUser;
    if (user && !user.emailVerified) {
      user.sendEmailVerification().catch(() => {});
      setResendTimer(RESEND_COOLDOWN);
    }
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => setResendTimer((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleResend = useCallback(async () => {
    try {
      await auth().currentUser?.sendEmailVerification();
      setResendTimer(RESEND_COOLDOWN);
      alert.show('success', t('common.success'), t('auth.emailVerificationSent'));
    } catch {
      alert.show('error', t('common.error'), t('auth.otpError'));
    }
  }, [t, alert]);

  const handleRefresh = useCallback(async () => {
    setChecking(true);
    try {
      await refreshFirebaseUser();
      if (!auth().currentUser?.emailVerified) {
        alert.show('error', t('common.error'), t('auth.emailNotYetVerified'));
      }
    } catch {
      alert.show('error', t('common.error'), t('auth.otpError'));
    } finally {
      setChecking(false);
    }
  }, [t, refreshFirebaseUser, alert]);

  const handleLogout = useCallback(async () => {
    await auth().signOut();
  }, []);

  const email = auth().currentUser?.email || '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* Blue header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleLogout}>
          <View style={styles.backChevron} />
        </TouchableOpacity>
        <View style={[styles.logoCircle, { backgroundColor: '#FFFFFF' }]}>
          <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          {t('auth.verifyEmail')}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.headerTextSecondary }]}>
          {t('auth.emailVerificationSubtitle', { email })}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleRefresh}
          disabled={checking}
        >
          <Text style={styles.buttonText}>
            {checking ? t('auth.verifying') : t('auth.iVerified')}
          </Text>
        </TouchableOpacity>

        {resendTimer > 0 ? (
          <Text style={[styles.resendTimer, { color: colors.textSecondary }]}>
            {t('auth.resendIn', { seconds: resendTimer })}
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend} style={styles.resendLink}>
            <Text style={[styles.resendText, { color: colors.primary }]}>
              {t('auth.resendEmailVerification')}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleLogout} style={styles.logoutLink}>
          <Text style={[styles.logoutText, { color: colors.error }]}>
            {t('auth.backToLogin')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Step indicator with car */}
      <VerificationStepper currentStep={0} />

      <CarAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={alert.dismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendTimer: {
    fontSize: 14,
    marginBottom: 16,
  },
  resendLink: {
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '700',
  },
  logoutLink: {
    marginTop: 24,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
