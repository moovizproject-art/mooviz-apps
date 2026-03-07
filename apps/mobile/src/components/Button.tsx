/**
 * Button — כפתור
 * Reusable button with primary/secondary/outline/danger variants.
 * Supports loading state and disabled state.
 * כפתור עם וריאנטים: ראשי, משני, מתאר, סכנה
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: COLORS.primary },
    text: { color: COLORS.textInverse },
  },
  secondary: {
    container: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    text: { color: COLORS.text },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
    text: { color: COLORS.primary },
  },
  danger: {
    container: { backgroundColor: COLORS.error },
    text: { color: COLORS.textInverse },
  },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = true,
}: ButtonProps): React.JSX.Element {
  const variantStyle = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'outline' ? COLORS.primary : COLORS.textInverse}
        />
      ) : (
        <Text style={[styles.text, variantStyle.text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...TYPOGRAPHY.button,
  },
});
