import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useDelivery } from '../../hooks/useDelivery';
import { StatusBadge } from '../../components/StatusBadge';
import { AvatarCircle } from '../../components/AvatarCircle';
import { LoadingScreen } from '../../components/LoadingScreen';
import { STATUS_CONFIG } from '../../constants/statusConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'SenderDeliveryDetail'>;

/**
 * DeliveryDetailScreen (Sender) — מסך פרטי משלוח לשולח
 * Full delivery view: status timeline, driver info, map, chat button.
 * תצוגה מלאה: ציר זמן סטטוס, פרטי נהג, מפה, כפתור צ׳אט
 */
export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { getDeliveryById, isLoading } = useDelivery();
  const delivery = getDeliveryById(deliveryId);

  // Build status timeline steps
  // בניית שלבי ציר הזמן
  const timelineSteps = useMemo(() => {
    const steps = [
      { key: 'pending', label: 'ממתין לנהג' /* Waiting for driver */ },
      { key: 'matched', label: 'נהג נמצא' /* Driver found */ },
      { key: 'picked_up', label: 'נאסף' /* Picked up */ },
      { key: 'in_transit', label: 'בדרך' /* In transit */ },
      { key: 'delivered', label: 'נמסר' /* Delivered */ },
    ];
    return steps;
  }, []);

  if (isLoading || !delivery) {
    return <LoadingScreen />;
  }

  const currentStepIndex = timelineSteps.findIndex((s) => s.key === delivery.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Status badge */}
      {/* תג סטטוס */}
      <View style={styles.statusSection}>
        <StatusBadge status={delivery.status} />
      </View>

      {/* Status timeline */}
      {/* ציר זמן סטטוס */}
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>מעקב משלוח</Text>
        {/* Delivery tracking */}
        {timelineSteps.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <View key={step.key} style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  isCompleted && styles.timelineDotCompleted,
                  isCurrent && styles.timelineDotCurrent,
                ]}
              />
              {index < timelineSteps.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    isCompleted && styles.timelineLineCompleted,
                  ]}
                />
              )}
              <Text
                style={[
                  styles.timelineLabel,
                  isCompleted && styles.timelineLabelCompleted,
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Delivery details */}
      {/* פרטי המשלוח */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>פרטי המשלוח</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>מ:</Text>
          <Text style={styles.detailValue}>{delivery.pickup?.address || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>אל:</Text>
          <Text style={styles.detailValue}>{delivery.destination?.address || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>פריט:</Text>
          <Text style={styles.detailValue}>{delivery.itemDescription || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>מחיר:</Text>
          <Text style={styles.detailValue}>₪{delivery.suggestedPrice || 0}</Text>
        </View>

        {delivery.photoUrl && (
          <Image source={{ uri: delivery.photoUrl }} style={styles.itemPhoto} />
        )}
      </View>

      {/* Map placeholder */}
      {/* מפה */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>מפה — מיקום הנהג בזמן אמת</Text>
        {/* Map — Real-time driver location */}
      </View>

      {/* Driver info (when matched) */}
      {/* פרטי נהג (כשנמצא התאמה) */}
      {delivery.driverId && (
        <View style={styles.driverSection}>
          <Text style={styles.sectionTitle}>הנהג שלך</Text>
          {/* Your driver */}
          <View style={styles.driverCard}>
            <AvatarCircle
              name={delivery.driverName || ''}
              photoUrl={delivery.driverPhotoUrl}
              size={48}
            />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{delivery.driverName}</Text>
              <Text style={styles.driverRating}>
                {delivery.driverRating ? `${delivery.driverRating.toFixed(1)} ★` : 'חדש'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() =>
                navigation.navigate('ChatRoom', {
                  chatId: delivery.chatId || '',
                  recipientName: delivery.driverName || 'נהג',
                })
              }
            >
              <Text style={styles.chatButtonText}>צ׳אט</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Actions based on status */}
      {/* פעולות לפי סטטוס */}
      {delivery.status === 'delivered' && !delivery.rated && (
        <TouchableOpacity
          style={styles.rateButton}
          onPress={() =>
            navigation.navigate('Rating', {
              deliveryId: delivery.id,
              targetUserId: delivery.driverId || '',
            })
          }
        >
          <Text style={styles.rateButtonText}>דרג את הנהג</Text>
          {/* Rate the driver */}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  statusSection: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: 12,
  },
  timelineSection: {
    marginBottom: 24,
    paddingRight: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.border,
    marginLeft: 12,
  },
  timelineDotCompleted: {
    backgroundColor: COLORS.success,
  },
  timelineDotCurrent: {
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: 'rgba(26,115,232,0.3)',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  timelineLine: {
    position: 'absolute',
    right: 22,
    top: 20,
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
  },
  timelineLineCompleted: {
    backgroundColor: COLORS.success,
  },
  timelineLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  timelineLabelCompleted: {
    color: COLORS.text,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  itemPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  driverSection: {
    marginBottom: 24,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  driverRating: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chatButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  rateButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
