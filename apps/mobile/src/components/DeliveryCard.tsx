/**
 * DeliveryCard - כרטיס משלוח
 * Glass morphism delivery card for feeds and lists.
 * Shows item, route, status, and price with press animation.
 * כרטיס משלוח בעיצוב זכוכית לפידים ורשימות
 */
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, I18nManager } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BRAND, BORDER_RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '../constants/design';
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
        {/* תמונה ממוזערת */}
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
        {/* פרטים */}
        <View style={styles.details}>
          {/* Top row: status + price */}
          <View style={styles.topRow}>
            <StatusIndicator status={delivery.status} size="sm" />
            {delivery.suggestedPrice != null && (
              <Text style={styles.price}>
                {formatCurrency(delivery.suggestedPrice)}
              </Text>
            )}
          </View>

          {/* Route */}
          {/* מסלול */}
          <View style={styles.routeSection}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: BRAND.success }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {delivery.pickup?.address || '\u05DB\u05EA\u05D5\u05D1\u05EA \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4'}
                {/* כתובת לא זמינה */}
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

          {/* Item description */}
          {delivery.itemDescription ? (
            <Text style={styles.itemText} numberOfLines={1}>
              {delivery.itemDescription}
            </Text>
          ) : null}

          {/* Bottom: date + distance */}
          <View style={styles.bottomRow}>
            {delivery.createdAt ? (
              <Text style={styles.metaText}>
                {formatRelativeDate(delivery.createdAt)}
              </Text>
            ) : null}
            {showDistance && delivery.distance != null ? (
              <Text style={styles.distanceText}>
                {delivery.distance.toFixed(1)} {'\u05E7\u05F4\u05DE'}
                {/* ק״מ */}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.surfaceGlass,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: BRAND.borderLight,
    ...SHADOWS.md,
  },
  content: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: SPACING.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
  },
  thumbPlaceholder: {
    backgroundColor: BRAND.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 24,
  },
  mediaCountBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
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
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.success,
  },
  routeSection: {
    marginBottom: SPACING.xs,
    gap: 2,
  },
  routeRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  routeLine: {
    width: 1,
    height: 8,
    backgroundColor: BRAND.border,
    marginLeft: I18nManager.isRTL ? 0 : 3,
    marginRight: I18nManager.isRTL ? 3 : 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  addressText: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    color: BRAND.textPrimary,
  },
  itemText: {
    ...TYPOGRAPHY.small,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    color: BRAND.textSecondary,
    marginBottom: SPACING.xs,
  },
  bottomRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  metaText: {
    ...TYPOGRAPHY.small,
    color: BRAND.textSecondary,
  },
  distanceText: {
    ...TYPOGRAPHY.small,
    fontWeight: '600',
    color: BRAND.primary,
  },
});
