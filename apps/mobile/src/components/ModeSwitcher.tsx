import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BRAND, BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/design';

type AppMode = 'client' | 'driver';

interface ModeSwitcherProps {
  activeMode: AppMode;
  onToggle: (mode: AppMode) => void;
  driverUnlocked: boolean;
}

/**
 * ModeSwitcher — מתג מצב לקוח/נהג
 * Toggle switch between client and driver modes.
 * מתג להחלפה בין מצב לקוח ומצב נהג
 */
export function ModeSwitcher({
  activeMode,
  onToggle,
  driverUnlocked,
}: ModeSwitcherProps): React.JSX.Element {
  const indicatorX = useSharedValue(activeMode === 'client' ? 0 : 1);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value * 100 }],
  }));

  const handlePress = (mode: AppMode) => {
    if (mode === 'driver' && !driverUnlocked) {
      return;
    }
    indicatorX.value = withSpring(mode === 'client' ? 0 : 1, {
      damping: 18,
      stiffness: 200,
    });
    onToggle(mode);
  };

  if (!driverUnlocked) {
    return (
      <View style={styles.container}>
        <View style={[styles.track, styles.trackSingle]}>
          <Text style={[styles.activeLabel]}>לקוח</Text>
        </View>
        <Pressable
          style={styles.unlockButton}
          onPress={() => onToggle('driver')}
        >
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unlockText}>הפוך לנהג</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        <Pressable style={styles.option} onPress={() => handlePress('client')}>
          <Text
            style={[
              styles.optionText,
              activeMode === 'client' && styles.activeLabel,
            ]}
          >
            לקוח
          </Text>
        </Pressable>
        <Pressable style={styles.option} onPress={() => handlePress('driver')}>
          <Text
            style={[
              styles.optionText,
              activeMode === 'driver' && styles.activeLabel,
            ]}
          >
            נהג
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
    gap: SPACING.md,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: BRAND.borderLight,
    borderRadius: BORDER_RADIUS.full,
    position: 'relative',
    width: OPTION_WIDTH * 2,
    height: 36,
  },
  trackSingle: {
    width: OPTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.primary,
  },
  indicator: {
    position: 'absolute',
    width: OPTION_WIDTH,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: BRAND.primary,
    ...SHADOWS.sm,
  },
  option: {
    width: OPTION_WIDTH,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  optionText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: BRAND.textSecondary,
  },
  activeLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: BRAND.textInverse,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  lockIcon: {
    fontSize: 14,
  },
  unlockText: {
    ...TYPOGRAPHY.small,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
});
