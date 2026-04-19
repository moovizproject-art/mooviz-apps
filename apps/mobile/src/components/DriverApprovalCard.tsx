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
import { useI18n } from '../i18n/I18nContext';
import { AvatarCircle } from './AvatarCircle';
import { LoadingOverlay } from './LoadingOverlay';

interface DriverApprovalCardProps {
  driverId: string;
  deliveryId: string;
  onActionComplete?: () => void;
}

export function DriverApprovalCard({ driverId, deliveryId, onActionComplete }: DriverApprovalCardProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'approve' | 'decline' | null>(null);
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

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
    setLoadingStep(0);
    setLoadingVisible(true);
    try {
      const fn = functions().httpsCallable('approveDriver');
      await fn({ deliveryId });
      setLoadingStep(1);
      await new Promise(r => setTimeout(r, 600));
      setLoadingVisible(false);
      onActionComplete?.();
    } catch (err: any) {
      setLoadingVisible(false);
      console.error('[DriverApprovalCard] Approve error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    setActionLoading('decline');
    setLoadingStep(0);
    setLoadingVisible(true);
    try {
      const fn = functions().httpsCallable('declineDriver');
      await fn({ deliveryId });
      setLoadingStep(1);
      await new Promise(r => setTimeout(r, 600));
      setLoadingVisible(false);
      onActionComplete?.();
    } catch (err: any) {
      setLoadingVisible(false);
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

  const displayName = driver.nickname || driver.fullName || t('driver.driverLabel');
  const rating = driver.ratingAsDriver?.average;
  const deliveries = driver.completedDeliveries;
  const vehicleIcons: Record<string, string> = { bicycle: '🚲', bike: '🏍', car: '🚗', truck: '🚚' };
  const vehicleLabels: Record<string, string> = {
    bicycle: t('driver.vehicleBicycle'),
    bike: t('driver.vehicleBike'),
    car: t('driver.vehicleCar'),
    truck: t('driver.vehicleTruck'),
  };
  const vehicleType = driver.vehicleType || driver.preferences?.vehicleType;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('driver.interestedInDelivery')}</Text>

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
            {vehicleType && vehicleIcons[vehicleType] && (
              <View style={[styles.badge, { backgroundColor: '#F3E5F5' }]}>
                <Text style={styles.badgeText}>{vehicleIcons[vehicleType]} {vehicleLabels[vehicleType] || vehicleType}</Text>
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
            <Text style={styles.btnText}>✓ {t('driver.confirmDriver')}</Text>
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
            <Text style={[styles.declineBtnText]}>✗ {t('driver.declineDriver')}</Text>
          )}
        </TouchableOpacity>
      </View>
      <LoadingOverlay
        visible={loadingVisible}
        steps={['sendingRequest', 'almostDone']}
        currentStep={loadingStep}
        timeout={60000}
        onTimeout={() => setLoadingVisible(false)}
        onCancel={() => setLoadingVisible(false)}
      />
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
    flexWrap: 'wrap',
    gap: 6,
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
