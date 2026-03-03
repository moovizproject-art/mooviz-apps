import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { COLORS } from '../constants/colors';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, formatRelativeDate } from '../utils/formatters';

interface DeliveryData {
  id: string;
  status: string;
  pickup?: { address: string };
  destination?: { address: string };
  itemDescription?: string;
  suggestedPrice?: number;
  createdAt?: Date | string;
  distance?: number;
}

interface DeliveryCardProps {
  delivery: DeliveryData;
  onPress: () => void;
  showDistance?: boolean;
}

/**
 * DeliveryCard — כרטיס משלוח
 * Card showing delivery summary, used in feeds and lists.
 * כרטיס סיכום משלוח לשימוש בפידים ורשימות
 */
export function DeliveryCard({ delivery, onPress, showDistance = false }: DeliveryCardProps): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Top row: status + price */}
      <View style={styles.topRow}>
        <StatusBadge status={delivery.status} />
        {delivery.suggestedPrice != null && (
          <Text style={styles.price}>{formatCurrency(delivery.suggestedPrice)}</Text>
        )}
      </View>

      {/* Route info */}
      {/* מידע על המסלול */}
      <View style={styles.routeSection}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.addressText} numberOfLines={1}>
            {delivery.pickup?.address || 'כתובת לא זמינה'}
            {/* Address unavailable */}
          </Text>
        </View>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.error }]} />
          <Text style={styles.addressText} numberOfLines={1}>
            {delivery.destination?.address || 'כתובת לא זמינה'}
          </Text>
        </View>
      </View>

      {/* Item description */}
      {delivery.itemDescription && (
        <Text style={styles.itemText} numberOfLines={1}>
          {delivery.itemDescription}
        </Text>
      )}

      {/* Bottom row: date + distance */}
      <View style={styles.bottomRow}>
        {delivery.createdAt && (
          <Text style={styles.dateText}>{formatRelativeDate(delivery.createdAt)}</Text>
        )}
        {showDistance && delivery.distance != null && (
          <Text style={styles.distanceText}>
            {delivery.distance.toFixed(1)} ק״מ
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.success,
  },
  routeSection: {
    marginBottom: 8,
    gap: 6,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  itemText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
