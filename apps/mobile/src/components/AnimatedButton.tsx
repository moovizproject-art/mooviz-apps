/**
 * AnimatedButton - כפתור מונפש
 * Button with spring press animation and multiple variants.
 * כפתור עם אנימציית לחיצה קפיצית ווריאנטים מרובים
 */
import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BRAND, BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/design';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: BRAND.primary, text: BRAND.textInverse },
  secondary: { bg: BRAND.borderLight, text: BRAND.textPrimary },
  outline: { bg: 'transparent', text: BRAND.primary, border: BRAND.primary },
  ghost: { bg: 'transparent', text: BRAND.primary },
  accent: { bg: BRAND.accent, text: BRAND.textInverse },
};

export function AnimatedButton({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, style, icon,
}: AnimatedButtonProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const vs = VARIANT_STYLES[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (): void => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = (): void => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        SIZE_STYLES[size],
        {
          backgroundColor: isDisabled ? BRAND.border : vs.bg,
          borderColor: vs.border || 'transparent',
          borderWidth: vs.border ? 1.5 : 0,
        },
        variant !== 'outline' && variant !== 'ghost' && SHADOWS.sm,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[
            styles.label,
            { color: isDisabled ? BRAND.textMuted : vs.text },
          ]}>
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const SIZE_STYLES: Record<string, ViewStyle> = {
  sm: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  md: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
  lg: { paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xxl },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 48,
  },
  label: {
    ...TYPOGRAPHY.button,
    textAlign: 'center',
  },
});
