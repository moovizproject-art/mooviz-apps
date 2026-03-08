import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { SPACING, BORDER_RADIUS, SHADOWS } from '../theme/tokens';

const logo = require('../assets/logo.png');

interface TabHeaderProps {
  title: string;
  onSettingsPress?: () => void;
}

export function TabHeader({ title, onSettingsPress }: TabHeaderProps): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + SPACING.sm }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <View style={styles.headerTopRow}>
        <View style={[styles.logoCircle, { backgroundColor: '#FFFFFF' }]}>
          <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        </View>
        {onSettingsPress && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onSettingsPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.settingsIcon}>{'\u2699'}</Text>
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
    left: 0,
    top: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
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
