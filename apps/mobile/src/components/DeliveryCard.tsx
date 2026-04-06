/**
 * DeliveryCard - כרטיס משלוח
 * Compact delivery card for feeds and lists.
 * Shows item, route, status, driver, date/time, and price.
 */
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BRAND, BORDER_RADIUS, SPACING } from '../constants/design';
import { useTheme } from '../theme/ThemeContext';
import { StatusIndicator } from './StatusIndicator';
import { formatCurrency, formatDate } from '../utils/formatters';

const SIZE_LABELS_HE: Record<string, string> = {
  small: 'מעטפה',
  medium: 'חבילה',
  large: 'חבילה גדולה',
  xlarge: 'משטח/ארגז',
};
const SIZE_ICONS: Record<string, string> = {
  small: '✉️',
  medium: '📦',
  large: '📦',
  xlarge: '🚚',
};

const TIME_RANGE_LABELS: Record<string, string> = {
  morning: 'בוקר 08–12',
  afternoon: 'צהריים 12–16',
  evening: 'ערב 16–20',
  night: 'לילה 20–24',
};

function formatPickupInfo(
  pickupDate?: string | null | { _seconds?: number; toDate?: () => Date; seconds?: number },
  scheduledDate?: string | null,
  timeRange?: string | null,
): string {
  const raw = pickupDate ?? scheduledDate;

  // ASAP
  if (!raw || raw === 'asap') {
    const rangeLabel = timeRange ? TIME_RANGE_LABELS[timeRange] : null;
    return rangeLabel ? `בהקדם • ${rangeLabel}` : 'בהקדם';
  }

  // Parse date from various formats
  let d: Date;
  if (typeof raw === 'object' && raw !== null) {
    if (typeof (raw as any).toDate === 'function') {
      d = (raw as any).toDate();
    } else if ((raw as any)._seconds) {
      d = new Date((raw as any)._seconds * 1000);
    } else if ((raw as any).seconds) {
      d = new Date((raw as any).seconds * 1000);
    } else {
      return 'בהקדם';
    }
  } else if (typeof raw === 'string') {
    d = new Date(raw);
  } else {
    return 'בהקדם';
  }

  if (isNaN(d.getTime())) return 'בהקדם';

  const formatted = formatDate(d);
  const rangeLabel = timeRange ? TIME_RANGE_LABELS[timeRange] : null;
  return rangeLabel ? `${formatted} • ${rangeLabel}` : formatted;
}

interface RatingSummary {
  rating: number;
  comment?: string;
}

interface DeliveryData {
  id: string;
  status: string;
  pickup?: { address: string };
  destination?: { address: string };
  item?: { description: string; size?: string };
  itemDescription?: string;
  itemSize?: string;
  photoUrl?: string;
  mediaURLs?: string[];
  price?: number;
  suggestedPrice?: number;
  createdAt?: Date | string;
  pickupDate?: string | null | { _seconds?: number; toDate?: () => Date; seconds?: number };
  scheduledDate?: string | null;
  timeRange?: string | null;
  distance?: number;
  driverName?: string;
  driverVehicleType?: string;
  interestedDrivers?: { uid: string; status?: string }[];
  ratedBySender?: boolean;
  ratedByDriver?: boolean;
  senderRatingGiven?: RatingSummary;
  driverRatingGiven?: RatingSummary;
}

interface DeliveryCardProps {
  delivery: DeliveryData;
  onPress: () => void;
  showDistance?: boolean;
  /** Override default distance text (e.g. "3.2 ק״מ מהבית") */
  distanceLabel?: string;
  /** Show bold border for unread/new notifications */
  isUnread?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const DeliveryCard = React.memo(function DeliveryCard({
  delivery,
  onPress,
  showDistance = false,
  distanceLabel,
  isUnread = false,
}: DeliveryCardProps): React.JSX.Element {
  const { colors } = useTheme();
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

  const itemDesc = delivery.item?.description || delivery.itemDescription;
  const pickupInfo = formatPickupInfo(delivery.pickupDate, delivery.scheduledDate, delivery.timeRange);
  const sizeKey = delivery.itemSize || delivery.item?.size || 'small';
  const sizeLabel = SIZE_LABELS_HE[sizeKey] ?? SIZE_LABELS_HE.small;
  const sizeIcon = SIZE_ICONS[sizeKey] ?? SIZE_ICONS.small;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: isUnread ? colors.primary : colors.border, borderWidth: isUnread ? 2.5 : 1 }, animatedStyle]}
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
            <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: colors.border }]}>
              <Text style={styles.thumbIcon}>{'\u{1F4E6}'}</Text>
            </View>
          );
        })()}

        {/* Details */}
        <View style={styles.details}>
          {/* Top row: item description + status */}
          <View style={styles.topRow}>
            <Text style={[styles.itemText, { color: colors.textPrimary }]} numberOfLines={1}>
              {itemDesc || 'משלוח'}
            </Text>
            <View style={styles.statusArea}>
              {(() => {
                const drivers = delivery.interestedDrivers?.filter(
                  (d) => d.status === 'interested' || d.status === 'confirmed'
                ) ?? [];
                const hasDrivers = drivers.length > 0;
                const isWaiting = delivery.status === 'pending' || delivery.status === 'new';
                return (
                  <>
                    {hasDrivers && isWaiting ? (
                      <View style={[styles.waitingBadge, { backgroundColor: '#FFF3E0' }]}>
                        <Text style={styles.waitingText}>🕐 ממתין לתשובה</Text>
                      </View>
                    ) : (
                      <StatusIndicator status={delivery.status} size="sm" />
                    )}
                  </>
                );
              })()}
            </View>
          </View>

          {/* Route */}
          <View style={styles.routeSection}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: BRAND.success }]} />
              <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={1}>
                {delivery.pickup?.address || '—'}
              </Text>
            </View>
            <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: BRAND.error }]} />
              <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={1}>
                {delivery.destination?.address || '—'}
              </Text>
            </View>
          </View>

          {/* Driver name (if assigned) */}
          {delivery.driverName ? (
            <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
              {({ bicycle: '🚲', bike: '🏍', car: '🚗', truck: '🚚' } as Record<string, string>)[delivery.driverVehicleType || 'car'] || '🚗'} {delivery.driverName}
            </Text>
          ) : null}

          {/* Date + time range */}
          <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
            📅 {pickupInfo}
          </Text>

          {/* Package size badge */}
          <View style={[styles.sizeBadge, { backgroundColor: colors.border }]}>
            <Text style={[styles.sizeBadgeText, { color: colors.textPrimary }]}>{sizeIcon} {sizeLabel}</Text>
          </View>

          {/* Ratings preview — visible when any rating exists */}
          {(delivery.senderRatingGiven || delivery.driverRatingGiven) && (
            <View style={styles.ratingsPreview}>
              {delivery.senderRatingGiven && (
                <View style={styles.ratingPreviewRow}>
                  <Text style={styles.ratingRoleIcon}>📦</Text>
                  <Text style={styles.ratingStarsSmall}>
                    {'★'.repeat(delivery.senderRatingGiven.rating)}
                    {'☆'.repeat(5 - delivery.senderRatingGiven.rating)}
                  </Text>
                  {delivery.senderRatingGiven.comment ? (
                    <Text style={[styles.ratingCommentPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                      {delivery.senderRatingGiven.comment}
                    </Text>
                  ) : null}
                </View>
              )}
              {delivery.driverRatingGiven && (
                <View style={styles.ratingPreviewRow}>
                  <Text style={styles.ratingRoleIcon}>🚗</Text>
                  <Text style={styles.ratingStarsSmall}>
                    {'★'.repeat(delivery.driverRatingGiven.rating)}
                    {'☆'.repeat(5 - delivery.driverRatingGiven.rating)}
                  </Text>
                  {delivery.driverRatingGiven.comment ? (
                    <Text style={[styles.ratingCommentPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                      {delivery.driverRatingGiven.comment}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* Bottom: price + distance */}
          <View style={styles.bottomRow}>
            {distanceLabel ? (
              <Text style={styles.distanceText}>{distanceLabel}</Text>
            ) : showDistance && delivery.distance != null ? (
              <Text style={styles.distanceText}>
                {delivery.distance.toFixed(1)} ק״מ
              </Text>
            ) : <View />}
            {(delivery.price ?? delivery.suggestedPrice) != null && (
              <Text style={styles.price}>
                {formatCurrency(delivery.price ?? delivery.suggestedPrice ?? 0)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
});

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
  infoText: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  sizeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.borderLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  sizeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.textPrimary,
  },
  ratingsPreview: {
    marginTop: 4,
    gap: 2,
  },
  ratingPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingRoleIcon: {
    fontSize: 10,
  },
  ratingStarsSmall: {
    fontSize: 10,
    color: '#FFB800',
    letterSpacing: 1,
  },
  ratingCommentPreview: {
    fontSize: 11,
    color: BRAND.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  statusArea: {
    alignItems: 'flex-end',
    gap: 3,
  },
  driverCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  carIcon: {
    width: 18,
    height: 18,
    marginEnd: 4,
    resizeMode: 'contain',
    transform: [{ scaleX: -1 }],
  },
  driverCountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  waitingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E65100',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
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
