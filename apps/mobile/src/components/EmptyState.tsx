import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../constants/colors';

type IconType = 'package' | 'search' | 'message' | 'briefcase' | 'star' | 'camera';

const ICON_MAP: Record<IconType, string> = {
  package: '\u{1F4E6}',   // package emoji
  search: '\u{1F50D}',    // magnifier emoji
  message: '\u{1F4AC}',   // speech balloon
  briefcase: '\u{1F4BC}', // briefcase
  star: '\u{2B50}',       // star
  camera: '\u{1F4F7}',    // camera
};

interface EmptyStateProps {
  icon?: IconType;
  message: string;
  submessage?: string;
}

/**
 * EmptyState — מצב ריק
 * Empty state display with icon and message.
 * תצוגת מצב ריק עם אייקון והודעה
 */
export function EmptyState({
  icon = 'package',
  message,
  submessage,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{ICON_MAP[icon]}</Text>
      <Text style={styles.message}>{message}</Text>
      {submessage && <Text style={styles.submessage}>{submessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  message: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  submessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
