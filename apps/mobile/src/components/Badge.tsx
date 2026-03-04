/**
 * Badge — תג
 * Notification count badge or dot indicator.
 * תג ספירת התראות או נקודה
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

import { COLORS } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/theme';

interface BadgeProps {
  /** Count to display. If 0 or undefined, shows dot variant. */
  count?: number;
  /** Maximum count to display (shows 99+ for larger values) */
  maxCount?: number;
  /** Custom color override */
  color?: string;
  style?: ViewStyle;
}

export function Badge({
  count,
  maxCount = 99,
  color = COLORS.error,
  style,
}: BadgeProps): React.JSX.Element {
  const isDot = count === undefined || count === 0;
  const displayCount = count && count > maxCount ? `${maxCount}+` : `${count}`;

  if (isDot) {
    return <View style={[styles.dot, { backgroundColor: color }, style]} />;
  }

  return (
    <View style={[styles.badge, { backgroundColor: color }, style]}>
      <Text style={styles.text}>{displayCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  text: {
    ...TYPOGRAPHY.small,
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 11,
  },
});
