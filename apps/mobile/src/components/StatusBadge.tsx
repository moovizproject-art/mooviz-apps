import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { STATUS_CONFIG, DeliveryStatus } from '../constants/statusConfig';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'default';
}

/**
 * StatusBadge — תג סטטוס
 * Colored badge displaying the current delivery status.
 * תג צבעוני המציג את סטטוס המשלוח הנוכחי
 */
export function StatusBadge({ status, size = 'default' }: StatusBadgeProps): React.JSX.Element {
  const config = STATUS_CONFIG[status as DeliveryStatus] || STATUS_CONFIG.pending;
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bgColor },
        isSmall && styles.badgeSmall,
      ]}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <Text
        style={[
          styles.label,
          { color: config.color },
          isSmall && styles.labelSmall,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelSmall: {
    fontSize: 11,
  },
});
