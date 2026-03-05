import React from 'react';
import { View, Text, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { BRAND, BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/design';

interface AvailabilityToggleProps {
  isAvailable: boolean;
  onToggle: (value: boolean) => void;
  isLoading?: boolean;
}

/**
 * AvailabilityToggle — מתג זמינות נהג
 * Green/gray switch with Hebrew labels for driver availability.
 * מתג ירוק/אפור עם תוויות בעברית לזמינות נהג
 */
export function AvailabilityToggle({
  isAvailable,
  onToggle,
  isLoading = false,
}: AvailabilityToggleProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isAvailable ? BRAND.success : BRAND.textMuted },
          ]}
        />
        <Text style={[styles.label, isAvailable && styles.labelActive]}>
          {isAvailable ? 'זמין למשלוחים' : 'לא זמין'}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={BRAND.primary} />
      ) : (
        <Switch
          value={isAvailable}
          onValueChange={onToggle}
          trackColor={{ false: BRAND.border, true: BRAND.success }}
          thumbColor={BRAND.surface}
          ios_backgroundColor={BRAND.border}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND.surfaceGlass,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: BRAND.borderLight,
    ...SHADOWS.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    ...TYPOGRAPHY.bodyBold,
    color: BRAND.textSecondary,
  },
  labelActive: {
    color: BRAND.success,
  },
});
