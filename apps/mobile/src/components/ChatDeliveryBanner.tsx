/**
 * ChatDeliveryBanner — באנר פרטי משלוח בצ׳אט
 * Collapsible card in the chat header showing delivery details:
 * - Recipient avatar + name
 * - Pickup → Destination
 * - Date + status badge
 * - Tap to expand/collapse, link to delivery detail
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { AvatarCircle } from './AvatarCircle';
import { getStatusConfig } from '../constants/statusConfig';
import { formatCurrency } from '../utils/formatters';
import { strings } from '../i18n/strings';

interface ChatDeliveryBannerProps {
  chatId: string;
  recipientName: string;
  onNavigateToDelivery?: (deliveryId: string) => void;
}

interface DeliveryInfo {
  id: string;
  status: string;
  pickupCity: string;
  destinationCity: string;
  pickupDate: string;
  price: number;
  driverName: string;
  driverPhotoUrl: string | null;
  senderName: string;
  senderPhotoUrl: string | null;
}

export function ChatDeliveryBanner({
  chatId,
  recipientName,
  onNavigateToDelivery,
}: ChatDeliveryBannerProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
  const [recipientPhoto, setRecipientPhoto] = useState<string | null>(null);
  const animHeight = useRef(new Animated.Value(0)).current;

  // Fetch delivery info + user photos from chat document
  useEffect(() => {
    if (!chatId) return;

    const fetchData = async () => {
      try {
        // Get chat doc to find deliveryId and participants
        const chatDoc = await firestore().collection('chats').doc(chatId).get();
        if (!chatDoc.exists) return;

        const chatData = chatDoc.data();
        const deliveryId = chatData?.deliveryId;
        const participants: string[] = chatData?.participants ?? [];

        // Get recipient photo
        const recipientId = participants.find((id) => id !== currentUser?.uid);
        if (recipientId) {
          const recipientDoc = await firestore().collection('users').doc(recipientId).get();
          if (recipientDoc.exists) {
            setRecipientPhoto(recipientDoc.data()?.profilePhotoURL || null);
          }
        }

        if (!deliveryId) return;

        // Get delivery info
        const deliveryDoc = await firestore().collection('deliveries').doc(deliveryId).get();
        if (!deliveryDoc.exists) return;

        const d = deliveryDoc.data()!;

        // Get driver and sender names + photos
        let driverName = '';
        let driverPhotoUrl: string | null = null;
        let senderName = '';
        let senderPhotoUrl: string | null = null;

        if (d.driverId) {
          const driverDoc = await firestore().collection('users').doc(d.driverId).get();
          if (driverDoc.exists) {
            driverName = driverDoc.data()?.fullName || '';
            driverPhotoUrl = driverDoc.data()?.profilePhotoURL || null;
          }
        }

        if (d.senderId) {
          const senderDoc = await firestore().collection('users').doc(d.senderId).get();
          if (senderDoc.exists) {
            senderName = senderDoc.data()?.fullName || '';
            senderPhotoUrl = senderDoc.data()?.profilePhotoURL || null;
          }
        }

        // Format pickup date
        let dateStr = strings.time.asap.he;
        if (d.pickupDate && d.pickupDate !== 'asap') {
          const date = d.pickupDate?.toDate ? d.pickupDate.toDate() : new Date(d.pickupDate);
          dateStr = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
        }

        setDelivery({
          id: deliveryId,
          status: d.status || 'new',
          pickupCity: d.pickup?.city || d.pickup?.address || '',
          destinationCity: d.destination?.city || d.destination?.address || '',
          pickupDate: dateStr,
          price: d.price || 0,
          driverName,
          driverPhotoUrl,
          senderName,
          senderPhotoUrl,
        });
      } catch (err) {
        console.warn('[ChatDeliveryBanner] Failed to fetch:', err);
      }
    };

    fetchData();
  }, [chatId, currentUser?.uid]);

  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(animHeight, {
      toValue,
      useNativeDriver: false,
      friction: 10,
      tension: 80,
    }).start();
  };

  const expandedHeight = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  const chevronRotation = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const statusConfig = delivery ? getStatusConfig(delivery.status) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {/* Compact row — always visible */}
      <TouchableOpacity style={styles.compactRow} onPress={toggleExpand} activeOpacity={0.7}>
        <AvatarCircle name={recipientName} photoUrl={recipientPhoto} size={36} />
        <View style={styles.compactInfo}>
          <Text style={[styles.recipientName, { color: colors.textPrimary }]} numberOfLines={1}>
            {recipientName}
          </Text>
          {statusConfig && (
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.icon} {statusConfig.label}
              </Text>
            </View>
          )}
        </View>
        <Animated.Text
          style={[styles.chevron, { color: colors.textSecondary, transform: [{ rotate: chevronRotation }] }]}
        >
          ▼
        </Animated.Text>
      </TouchableOpacity>

      {/* Expanded details */}
      <Animated.View style={[styles.expandedContent, { height: expandedHeight, overflow: 'hidden' }]}>
        {delivery && (
          <View style={styles.detailsInner}>
            {/* Route */}
            <View style={styles.routeRow}>
              <View style={styles.routeDot}>
                <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
                <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
              </View>
              <View style={styles.routeTexts}>
                <Text style={[styles.routeCity, { color: colors.textPrimary }]} numberOfLines={1}>
                  {delivery.pickupCity}
                </Text>
                <Text style={[styles.routeCity, { color: colors.textPrimary }]} numberOfLines={1}>
                  {delivery.destinationCity}
                </Text>
              </View>
            </View>

            {/* Date + Price + View delivery link */}
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {delivery.pickupDate} • {formatCurrency(delivery.price)}
              </Text>
              {onNavigateToDelivery && (
                <TouchableOpacity onPress={() => onNavigateToDelivery(delivery.id)}>
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    {strings.commonExtra.viewDelivery.he} ←
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Driver info (if assigned) */}
            {delivery.driverName ? (
              <View style={styles.driverRow}>
                <AvatarCircle name={delivery.driverName} photoUrl={delivery.driverPhotoUrl} size={24} />
                <Text style={[styles.driverName, { color: colors.textSecondary }]}>
                  {delivery.driverName}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  compactInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 12,
  },
  expandedContent: {
    paddingHorizontal: 14,
  },
  detailsInner: {
    paddingBottom: 10,
    gap: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    alignItems: 'center',
    width: 12,
    gap: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeLine: {
    width: 2,
    height: 12,
  },
  routeTexts: {
    flex: 1,
    gap: 6,
  },
  routeCity: {
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverName: {
    fontSize: 12,
  },
});
