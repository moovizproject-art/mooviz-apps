import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';

/**
 * CompleteProfileScreen — מסך השלמת פרופיל
 * Shown to authenticated users who don't have a Firestore profile yet.
 * Placeholder — will be implemented in the screens branch.
 */
export function CompleteProfileScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t('profile.editProfile')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('common.loading')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
});
