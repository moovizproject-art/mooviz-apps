/**
 * SkeletonLoader - טוען שלד
 * Animated skeleton placeholder for loading states.
 * מציג מקום לתוכן בזמן טעינה עם אנימציית פולס
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BORDER_RADIUS, BRAND } from '../constants/design';
import { useTheme } from '../theme/ThemeContext';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = '100%',
  height = 16,
  borderRadius = BORDER_RADIUS.sm,
  style,
}: SkeletonLoaderProps): React.JSX.Element {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, backgroundColor: colors.border } as ViewStyle,
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Skeleton card placeholder for delivery feed loading state */
export function SkeletonCard(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardRow}>
        <SkeletonLoader width={80} height={20} borderRadius={BORDER_RADIUS.sm} />
        <SkeletonLoader width={60} height={20} borderRadius={BORDER_RADIUS.sm} />
      </View>
      <SkeletonLoader width="100%" height={14} style={styles.gap} />
      <SkeletonLoader width="100%" height={14} style={styles.gap} />
      <SkeletonLoader width="60%" height={12} style={styles.gap} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: BRAND.border,
  },
  card: {
    backgroundColor: BRAND.surfaceGlass,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND.borderLight,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gap: {
    marginTop: 8,
  },
});
