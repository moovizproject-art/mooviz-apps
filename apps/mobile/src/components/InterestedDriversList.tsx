import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AvatarCircle } from './AvatarCircle';
import { SelectionCountdown } from './SelectionCountdown';

interface InterestedDriverEntry {
  uid: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  completedDeliveries: number;
  distanceKm: number;
  status: string;
}

interface Props {
  interestedDrivers: InterestedDriverEntry[];
  selectedDriverId: string | null;
  selectionExpiresAt: Date | string | null;
  onSelect: (driverUid: string) => void;
  onViewProfile: (driverUid: string) => void;
  onCancelSelection: () => void;
}

const STRUCK_STATUSES = ['declined', 'cancelled'];

export function InterestedDriversList({
  interestedDrivers,
  selectedDriverId,
  selectionExpiresAt,
  onSelect,
  onViewProfile,
  onCancelSelection,
}: Props): React.JSX.Element {
  const { colors } = useTheme();

  const visible = interestedDrivers.filter((d) => d.status !== 'withdrawn');
  const activeCount = visible.filter((d) => d.status === 'interested' || d.status === 'selected').length;
  const isSelectionPending = !!selectedDriverId;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: '#1a73e8' }]}>
      <Text style={[styles.header, { color: colors.textPrimary }]}>
        🚗 נהגים מעוניינים ({activeCount})
      </Text>

      {isSelectionPending && selectionExpiresAt && (
        <SelectionCountdown expiresAt={selectionExpiresAt} label="ממתין לאישור הנהג" />
      )}

      {visible.map((driver) => {
        const isStruck = STRUCK_STATUSES.includes(driver.status);
        const isSelected = driver.uid === selectedDriverId;
        const isDimmed = isSelectionPending && !isSelected && !isStruck;

        return (
          <TouchableOpacity
            key={driver.uid}
            onPress={() => !isStruck && !isDimmed && onViewProfile(driver.uid)}
            activeOpacity={isStruck || isDimmed ? 1 : 0.7}
            style={[
              styles.driverRow,
              {
                backgroundColor: isSelected ? '#F0FFF4' : isStruck ? '#F9FAFB' : '#F0F7FF',
                borderColor: isSelected ? '#22c55e' : colors.border,
              },
              isDimmed && { opacity: 0.4 },
            ]}
          >
            <AvatarCircle name={driver.name} photoUrl={driver.photoUrl} size={36} />
            <View style={styles.driverInfo}>
              <Text
                style={[
                  styles.driverName,
                  { color: isStruck ? '#9CA3AF' : colors.textPrimary },
                  isStruck && styles.strikethrough,
                ]}
                numberOfLines={1}
              >
                {driver.name}
              </Text>
              <Text style={[styles.driverMeta, { color: colors.textSecondary }]}>
                ⭐ {driver.rating.toFixed(1)} • {driver.completedDeliveries} משלוחים • {driver.distanceKm} ק״מ
              </Text>
              {isStruck && (
                <Text style={styles.struckLabel}>
                  {driver.status === 'declined' ? 'דחה' : 'בוטל'}
                </Text>
              )}
            </View>
            {!isStruck && !isDimmed && !isSelected && (
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => onSelect(driver.uid)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.selectBtnText}>בחר</Text>
              </TouchableOpacity>
            )}
            {isSelected && <Text style={styles.selectedLabel}>נבחר ✓</Text>}
          </TouchableOpacity>
        );
      })}

      {isSelectionPending && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancelSelection}>
          <Text style={styles.cancelBtnText}>בטל בחירה</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, padding: 16, borderWidth: 2, marginBottom: 12 },
  header: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
    borderRadius: 10, marginBottom: 8, borderWidth: 1,
  },
  driverInfo: { flex: 1, minWidth: 0 },
  driverName: { fontSize: 14, fontWeight: '600' },
  strikethrough: { textDecorationLine: 'line-through' },
  driverMeta: { fontSize: 11, marginTop: 2 },
  struckLabel: { fontSize: 10, color: '#EF4444', fontWeight: '600', marginTop: 2 },
  selectBtn: {
    backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
  },
  selectBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  selectedLabel: { fontSize: 12, fontWeight: '700', color: '#22c55e' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  cancelBtnText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
});
