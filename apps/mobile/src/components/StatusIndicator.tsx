/**
 * StatusIndicator - מחוון סטטוס
 * Colored pill badge displaying delivery status with Hebrew labels.
 * תג סטטוס צבעוני עם תוויות בעברית
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRAND, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../constants/design';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: '#E3F2FD', text: '#1565C0' },
  pending: { bg: BRAND.warningBg, text: '#E65100' },
  waiting: { bg: '#F3E5F5', text: '#7B1FA2' },
  matched: { bg: BRAND.warningBg, text: '#E65100' },
  picked_up: { bg: '#E0F7FA', text: '#00838F' },
  in_transit: { bg: BRAND.infoBg, text: BRAND.primary },
  delivered: { bg: BRAND.successBg, text: '#2E7D32' },
  cancelled: { bg: BRAND.errorBg, text: '#C62828' },
  completed_paid: { bg: BRAND.successBg, text: '#1B5E20' },
};

const STATUS_LABELS_HE: Record<string, string> = {
  new: '\u05D7\u05D3\u05E9',
  pending: '\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8',
  waiting: '\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E1\u05D5\u05E3',
  matched: '\u05DE\u05DE\u05EA\u05D9\u05DF',
  picked_up: '\u05E0\u05D0\u05E1\u05E3',
  in_transit: '\u05D1\u05D3\u05E8\u05DA',
  delivered: '\u05E0\u05DE\u05E1\u05E8',
  cancelled: '\u05D1\u05D5\u05D8\u05DC',
  completed_paid: '\u05D4\u05D5\u05E9\u05DC\u05DD \u05D5\u05E9\u05D5\u05DC\u05DD',
};

interface StatusIndicatorProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps): React.JSX.Element {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.new;
  const label = STATUS_LABELS_HE[status] || status;

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.bg },
      size === 'sm' && styles.containerSm,
    ]}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text style={[
        styles.label,
        { color: colors.text },
        size === 'sm' && styles.labelSm,
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
    alignSelf: 'flex-start',
  },
  containerSm: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 10,
  },
});
