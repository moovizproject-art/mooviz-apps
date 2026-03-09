/**
 * DeliveryCard - כרטיס משלוח
 * Compact delivery card for feeds and lists.
 * Shows item, route, status, driver, and price.
 */
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BRAND, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../constants/design';
import { StatusIndicator } from './StatusIndicator';
import { formatCurrency, formatRelativeDate } from '../utils/formatters';

interface DeliveryData {
  id: string;
  status: string;
  pickup?: { address: string };
  destination?: { address: string };
  itemDescription?: string;
  photoUrl?: string;
  mediaURLs?: string[];
  suggestedPrice?: number;
  createdAt?: Date | string;
  distance?: number;
  driverName?: string;
}

interface DeliveryCardProps {
  delivery: DeliveryData;
  onPress: () => void;
  showDistance?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function DeliveryCard({
  delivery,
  onPress,
  showDistance = false,
}: DeliveryCardProps): React.JSX.Element {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (): void => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = (): void => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle]}
    >
      <View style={styles.content}>
        {/* Thumbnail */}
        {(() => {
          const thumbnailUrl = delivery.mediaURLs?.[0] || delivery.photoUrl;
          const mediaCount = delivery.mediaURLs?.length || (delivery.photoUrl ? 1 : 0);
          return thumbnailUrl ? (
            <View>
              <Image source={{ uri: thumbnailUrl }} style={styles.thumb} />
              {mediaCount > 1 && (
                <View style={styles.mediaCountBadge}>
                  <Text style={styles.mediaCountText}>{mediaCount}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Text style={styles.thumbIcon}>{'\u{1F4E6}'}</Text>
            </View>
          );
        })()}

        {/* Details */}
        <View style={styles.details}>
          {/* Top row: status on end side */}
          <View style={styles.topRow}>
            {delivery.itemDescription ? (
              <Text style={styles.itemText} numberOfLines={1}>
                {delivery.itemDescription}
              </Text>
            ) : (
              <Text style={styles.itemText} numberOfLines={1}>משלוח</Text>
            )}
            <StatusIndicator status={delivery.status} size="sm" />
          </View>

          {/* Route */}
          <View style={styles.routeSection}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: BRAND.success }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {delivery.pickup?.address || '\u05DB\u05EA\u05D5\u05D1\u05EA \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4'}
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: BRAND.error }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {delivery.destination?.address || '\u05DB\u05EA\u05D5\u05D1\u05EA \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4'}
              </Text>
            </View>
          </View>

          {/* Driver name (if assigned) */}
          {delivery.driverName ? (
            <Text style={styles.driverText} numberOfLines={1}>
              🚛 {delivery.driverName}
            </Text>
          ) : null}

          {/* Bottom: date + price + distance */}
          <View style={styles.bottomRow}>
            {delivery.createdAt ? (
              <Text style={styles.metaText}>
                {formatRelativeDate(delivery.createdAt)}
              </Text>
            ) : null}
            <View style={styles.bottomEnd}>
              {showDistance && delivery.distance != null ? (
                <Text style={styles.distanceText}>
                  {delivery.distance.toFixed(1)} {'\u05E7\u05F4\u05DE'}
                </Text>
              ) : null}
              {delivery.suggestedPrice != null && (
                <Text style={styles.price}>
                  {formatCurrency(delivery.suggestedPrice)}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: BRAND.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  content: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.sm,
  },
  thumbPlaceholder: {
    backgroundColor: BRAND.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 22,
  },
  mediaCountBadge: {
    position: 'absolute',
    bottom: 2,
    end: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  mediaCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  details: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.textPrimary,
    flex: 1,
    marginEnd: 8,
  },
  routeSection: {
    marginBottom: 2,
    gap: 1,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeLine: {
    width: 1,
    height: 6,
    backgroundColor: BRAND.border,
    marginStart: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  addressText: {
    fontSize: 12,
    color: BRAND.textPrimary,
    flex: 1,
  },
  driverText: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
    marginBottom: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  bottomEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 11,
    color: BRAND.textSecondary,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.success,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.primary,
  },
});
