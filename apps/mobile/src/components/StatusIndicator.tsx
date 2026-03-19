/**
 * StatusIndicator - מחוון סטטוס
 * Colored pill badge displaying delivery status with localized labels.
 * תג סטטוס צבעוני עם תוויות מתורגמות
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useI18n } from '../i18n/I18nContext';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../constants/design';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new:                { bg: '#E3F2FD', text: '#1565C0' },
  pending:            { bg: '#FFF3E0', text: '#E65100' },
  awaiting_confirm:   { bg: '#FFF3E0', text: '#FF6F00' },
  waiting_for_pickup: { bg: '#F3E5F5', text: '#7B1FA2' },
  picked_up:          { bg: '#E0F7FA', text: '#00838F' },
  delivered:          { bg: '#E8F5E9', text: '#2E7D32' },
  awaiting_payment:   { bg: '#FFF3E0', text: '#F57C00' },
  completed_paid:     { bg: '#E8F5E9', text: '#1B5E20' },
  cancelled:          { bg: '#FFEBEE', text: '#C62828' },
};

const STATUS_I18N_KEYS: Record<string, string> = {
  new:                'status.new',
  pending:            'status.pending',
  awaiting_confirm:   'status.awaitingConfirm',
  waiting_for_pickup: 'status.waitingForPickup',
  picked_up:          'status.pickedUp',
  delivered:          'status.delivered',
  awaiting_payment:   'status.awaitingPayment',
  completed_paid:     'status.completedPaid',
  cancelled:          'status.cancelled',
};

interface StatusIndicatorProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps): React.JSX.Element {
  const { t } = useI18n();
  const statusColors = STATUS_COLORS[status] || STATUS_COLORS.new;
  const label = t(STATUS_I18N_KEYS[status] || 'status.new');

  return (
    <View style={[
      styles.container,
      { backgroundColor: statusColors.bg },
      size === 'sm' && styles.containerSm,
    ]}>
      <View style={[styles.dot, { backgroundColor: statusColors.text }]} />
      <Text style={[
        styles.label,
        { color: statusColors.text },
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
