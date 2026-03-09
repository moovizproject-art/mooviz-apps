import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { useTheme } from '../theme/ThemeContext';
import { AvatarCircle } from './AvatarCircle';

interface DriverApprovalCardProps {
  driverId: string;
  deliveryId: string;
  onActionComplete?: () => void;
}

export function DriverApprovalCard({ driverId, deliveryId, onActionComplete }: DriverApprovalCardProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'approve' | 'decline' | null>(null);

  useEffect(() => {
    if (!driverId) return;
    const unsub = firestore().doc(`users/${driverId}`).onSnapshot((snap) => {
      if (snap.exists) {
        setDriver({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [driverId]);

  const handleApprove = async () => {
    setActionLoading('approve');
    try {
      const fn = functions().httpsCallable('approveDriver');
      await fn({ deliveryId });
      onActionComplete?.();
    } catch (err: any) {
      console.error('[DriverApprovalCard] Approve error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    setActionLoading('decline');
    try {
      const fn = functions().httpsCallable('declineDriver');
      await fn({ deliveryId });
      onActionComplete?.();
    } catch (err: any) {
      console.error('[DriverApprovalCard] Decline error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!driver) return null;

  const displayName = driver.nickname || driver.fullName || 'נהג';
  const rating = driver.ratingAsDriver?.average;
  const deliveries = driver.completedDeliveries;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>נהג מעוניין במשלוח</Text>

      <View style={styles.driverRow}>
        <AvatarCircle
          name={driver.fullName || ''}
          photoUrl={driver.profilePhotoURL}
          size={52}
        />
        <View style={styles.driverInfo}>
          <Text style={[styles.driverName, { color: colors.textPrimary }]} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.badges}>
            {rating != null && rating > 0 && (
              <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
                <Text style={styles.badgeText}>⭐ {rating.toFixed(1)}</Text>
              </View>
            )}
            {deliveries != null && (
              <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.badgeText}>📦 {deliveries}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.approveBtn, { backgroundColor: colors.success }]}
          onPress={handleApprove}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'approve' ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.btnText}>✓ אשר נהג</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.declineBtn, { borderColor: '#E53935' }]}
          onPress={handleDecline}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'decline' ? (
            <ActivityIndicator color="#E53935" size="small" />
          ) : (
            <Text style={[styles.declineBtnText]}>✗ דחה</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  declineBtnText: {
    color: '#E53935',
    fontSize: 15,
    fontWeight: '700',
  },
});
