/**
 * GlassCard - כרטיס זכוכית
 * Reusable glass morphism card with frosted surface effect.
 * כרטיס עם אפקט זכוכית חלבית לשימוש חוזר
 */
import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BRAND, BORDER_RADIUS, SHADOWS, SPACING } from '../constants/design';

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof SPACING;
  radius?: keyof typeof BORDER_RADIUS;
}

export function GlassCard({ children, style, padding = 'lg', radius = 'lg' }: GlassCardProps): React.JSX.Element {
  return (
    <View style={[
      styles.container,
      { padding: SPACING[padding], borderRadius: BORDER_RADIUS[radius] },
      SHADOWS.md,
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BRAND.surfaceGlass,
    borderWidth: 1,
    borderColor: BRAND.borderLight,
  },
});
