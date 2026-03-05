import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme/tokens';

type AppMode = 'client' | 'driver';

interface ModeSwitcherProps {
  activeMode: AppMode;
  onToggle: (mode: AppMode) => void;
  driverUnlocked: boolean;
  variant?: 'header' | 'body';
}

export function ModeSwitcher({
  activeMode,
  onToggle,
  driverUnlocked,
  variant = 'body',
}: ModeSwitcherProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const indicatorX = useRef(new Animated.Value(activeMode === 'client' ? 0 : OPTION_WIDTH)).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: activeMode === 'client' ? 0 : OPTION_WIDTH,
      damping: 18,
      stiffness: 200,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [activeMode, indicatorX]);

  const isHeader = variant === 'header';
  const trackBg = isHeader ? 'rgba(255,255,255,0.2)' : colors.borderLight;
  const indicatorBg = isHeader ? '#FFFFFF' : colors.primary;
  const activeTextColor = isHeader ? colors.primary : colors.textInverse;
  const inactiveTextColor = isHeader ? 'rgba(255,255,255,0.8)' : colors.textSecondary;

  if (!driverUnlocked) {
    return (
      <View style={styles.container}>
        <Pressable
          style={[styles.ctaButton, { borderColor: isHeader ? 'rgba(255,255,255,0.4)' : colors.border }]}
          onPress={() => onToggle('driver')}
        >
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.ctaText, { color: isHeader ? '#FFFFFF' : colors.textSecondary }]}>
            {t('home.becomeDriver')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: indicatorBg, transform: [{ translateX: indicatorX }] },
          ]}
        />
        <Pressable style={styles.option} onPress={() => onToggle('client')}>
          <Text
            style={[
              styles.optionText,
              { color: activeMode === 'client' ? activeTextColor : inactiveTextColor },
              activeMode === 'client' && styles.activeText,
            ]}
          >
            {t('home.client')}
          </Text>
        </Pressable>
        <Pressable style={styles.option} onPress={() => onToggle('driver')}>
          <Text
            style={[
              styles.optionText,
              { color: activeMode === 'driver' ? activeTextColor : inactiveTextColor },
              activeMode === 'driver' && styles.activeText,
            ]}
          >
            {t('home.driver')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const OPTION_WIDTH = 100;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.full,
    position: 'relative',
    width: OPTION_WIDTH * 2,
    height: 38,
  },
  indicator: {
    position: 'absolute',
    width: OPTION_WIDTH,
    height: 38,
    borderRadius: BORDER_RADIUS.full,
    ...SHADOWS.sm,
  },
  option: {
    width: OPTION_WIDTH,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeText: {
    fontWeight: '700',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  lockIcon: {
    fontSize: 14,
  },
  ctaText: {
    ...TYPOGRAPHY.small,
    fontWeight: '600',
  },
});
