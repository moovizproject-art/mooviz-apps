import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SPACING, BORDER_RADIUS, SHADOWS } from '../theme/tokens';

const logo = require('../assets/logo.png');

interface TabHeaderProps {
  title: string;
  onSettingsPress?: () => void;
}

export function TabHeader({ title, onSettingsPress }: TabHeaderProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <View style={styles.headerTopRow}>
        <View style={[styles.logoCircle, { backgroundColor: '#FFFFFF' }]}>
          <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        </View>
        {onSettingsPress && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onSettingsPress}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.title, { color: colors.headerText }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  headerTopRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  settingsButton: {
    position: 'absolute',
    right: 0,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
});
