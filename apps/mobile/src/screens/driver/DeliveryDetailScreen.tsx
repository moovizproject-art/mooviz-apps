import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useDelivery } from '../../hooks/useDelivery';
import { StatusBadge } from '../../components/StatusBadge';
import { AvatarCircle } from '../../components/AvatarCircle';
import { LoadingScreen } from '../../components/LoadingScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDeliveryDetail'>;

/**
 * DeliveryDetailScreen (Driver) — מסך פרטי משלוח לנהג
 * Delivery details with "Express Interest" button.
 * פרטי משלוח עם כפתור "הבעת עניין"
 */
export function DeliveryDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId } = route.params;
  const { currentUser } = useAuth();
  const { getDeliveryById, expressInterest, updateDeliveryStatus, isLoading } = useDelivery();
  const delivery = getDeliveryById(deliveryId);

  const handleExpressInterest = async (): Promise<void> => {
    try {
      await expressInterest(deliveryId, currentUser!.uid);
      Alert.alert('הצלחה', 'הבעת העניין נשלחה לשולח!');
      // Success: Interest expressed to sender!
    } catch (err) {
      Alert.alert('שגיאה', 'לא ניתן לשלוח הבעת עניין. נסה שוב.');
      // Error: Cannot express interest
    }
  };

  const handleStatusUpdate = async (
    newStatus: 'picked_up' | 'in_transit' | 'delivered',
  ): Promise<void> => {
    const statusLabels: Record<string, string> = {
      picked_up: 'נאסף',
      in_transit: 'בדרך',
      delivered: 'נמסר',
    };
    try {
      await updateDeliveryStatus(deliveryId, newStatus);
      Alert.alert('עודכן', `הסטטוס עודכן ל: ${statusLabels[newStatus]}`);
    } catch (err) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן סטטוס');
    }
  };

  if (isLoading || !delivery) {
    return <LoadingScreen />;
  }

  const isMyJob = delivery.driverId === currentUser?.uid;
  const isPending = delivery.status === 'pending';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Status */}
      <View style={styles.statusRow}>
        <StatusBadge status={delivery.status} />
        <Text style={styles.deliveryId}>#{deliveryId.slice(0, 8)}</Text>
      </View>

      {/* Route info */}
      {/* מידע על המסלול */}
      <View style={styles.routeSection}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>איסוף</Text>
            {/* Pickup */}
            <Text style={styles.routeAddress}>{delivery.pickup?.address || '—'}</Text>
          </View>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: COLORS.error }]} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>יעד</Text>
            {/* Destination */}
            <Text style={styles.routeAddress}>{delivery.destination?.address || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Item details */}
      {/* פרטי הפריט */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>פרטי הפריט</Text>
        <Text style={styles.itemDescription}>{delivery.itemDescription}</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>גודל:</Text>
          <Text style={styles.detailValue}>{delivery.itemSize || '—'}</Text>
        </View>
        {delivery.photoUrl && (
          <Image source={{ uri: delivery.photoUrl }} style={styles.itemPhoto} />
        )}
      </View>

      {/* Price */}
      {/* מחיר */}
      <View style={styles.priceSection}>
        <Text style={styles.priceLabel}>תשלום</Text>
        {/* Payment */}
        <Text style={styles.priceValue}>₪{delivery.suggestedPrice || 0}</Text>
      </View>

      {/* Sender info */}
      {/* פרטי השולח */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>השולח</Text>
        <View style={styles.userCard}>
          <AvatarCircle
            name={delivery.senderName || ''}
            photoUrl={delivery.senderPhotoUrl}
            size={40}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{delivery.senderName}</Text>
            <Text style={styles.userRating}>
              {delivery.senderRating ? `${delivery.senderRating.toFixed(1)} ★` : 'חדש'}
            </Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      {delivery.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>הערות</Text>
          <Text style={styles.notesText}>{delivery.notes}</Text>
        </View>
      )}

      {/* Action buttons */}
      {/* כפתורי פעולה */}
      <View style={styles.actionsSection}>
        {isPending && !isMyJob && (
          <TouchableOpacity style={styles.interestButton} onPress={handleExpressInterest}>
            <Text style={styles.interestButtonText}>הבעת עניין</Text>
            {/* Express Interest */}
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'matched' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleStatusUpdate('picked_up')}
          >
            <Text style={styles.actionButtonText}>אישור איסוף</Text>
            {/* Confirm pickup */}
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'picked_up' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleStatusUpdate('in_transit')}
          >
            <Text style={styles.actionButtonText}>יצאתי לדרך</Text>
            {/* On my way */}
          </TouchableOpacity>
        )}

        {isMyJob && delivery.status === 'in_transit' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.success }]}
            onPress={() => handleStatusUpdate('delivered')}
          >
            <Text style={styles.actionButtonText}>אישור מסירה</Text>
            {/* Confirm delivery */}
          </TouchableOpacity>
        )}

        {isMyJob && (
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() =>
              navigation.navigate('ChatRoom', {
                chatId: delivery.chatId || '',
                recipientName: delivery.senderName || 'שולח',
              })
            }
          >
            <Text style={styles.chatButtonText}>צ׳אט עם השולח</Text>
            {/* Chat with sender */}
          </TouchableOpacity>
        )}
      </View>
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  deliveryId: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  routeSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  routeAddress: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'right',
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginRight: 5,
    marginVertical: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'right',
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  itemPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 12,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.success,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  userRating: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  interestButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  interestButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  chatButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  chatButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
