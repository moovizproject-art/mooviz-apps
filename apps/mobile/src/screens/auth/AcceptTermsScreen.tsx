import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';

const logo = require('../../assets/logo.png');

/**
 * AcceptTermsScreen — shown to Glide-migrated users who haven't accepted
 * the new Terms of Service and Privacy Policy yet.
 */
export function AcceptTermsScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser, updateProfile } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async (): Promise<void> => {
    if (!accepted || !currentUser?.uid) return;

    try {
      setIsLoading(true);
      // updateProfile writes to Firestore AND optimistically updates
      // local state, so navigation advances immediately without waiting
      // for serverTimestamp() to resolve from cache.
      await updateProfile({ acceptedTermsAt: new Date() });
    } catch {
      // Retry silently — user can tap again
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.headerSection}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('terms.title')}
        </Text>

        {/* Subtitle */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('terms.subtitle')}
        </Text>

        {/* Links */}
        <View style={styles.linksSection}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://mooviz-app-9b766.web.app/terms')}
            activeOpacity={0.7}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              {t('terms.termsOfService')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://mooviz-app-9b766.web.app/privacy')}
            activeOpacity={0.7}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              {t('terms.privacyPolicy')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAccepted(!accepted)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: colors.border, backgroundColor: colors.inputBg },
              accepted && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            {accepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>
            {t('terms.acceptLabel')}
          </Text>
        </TouchableOpacity>

        {/* Submit button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
            (!accepted || isLoading) && styles.submitButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!accepted || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>{t('terms.continue')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 200,
    height: 70,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  linksSection: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
