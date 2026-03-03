/**
 * Card — כרטיס
 * Container with elevated or outlined variants.
 * Supports optional press action.
 * מיכל עם וריאנטים: מוגבה או מתאר
 */
import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, SHADOW } from '../constants/theme';

type CardVariant = 'elevated' | 'outlined';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({
  children,
  variant = 'elevated',
  onPress,
  style,
}: CardProps): React.JSX.Element {
  const containerStyle = [
    styles.container,
    variant === 'elevated' ? styles.elevated : styles.outlined,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  elevated: {
    ...SHADOW.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
