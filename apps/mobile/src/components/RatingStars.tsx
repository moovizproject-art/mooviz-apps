/**
 * RatingStars — כוכבי דירוג
 * Display and interactive star rating component.
 * Supports half stars in display mode.
 * רכיב דירוג כוכבים — תצוגה ואינטראקטיבי
 */
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

import { COLORS } from '../constants/colors';

interface RatingStarsProps {
  /** Current rating value (0-5) */
  rating: number;
  /** Maximum number of stars */
  maxStars?: number;
  /** Star size in pixels */
  size?: number;
  /** Enable interactive mode (tap to set rating) */
  interactive?: boolean;
  /** Callback when rating changes (interactive mode) */
  onRate?: (rating: number) => void;
  /** Show numeric value next to stars */
  showValue?: boolean;
  style?: ViewStyle;
}

export function RatingStars({
  rating,
  maxStars = 5,
  size = 20,
  interactive = false,
  onRate,
  showValue = false,
  style,
}: RatingStarsProps): React.JSX.Element {
  const renderStar = (index: number): React.JSX.Element => {
    const starNumber = index + 1;
    const filled = rating >= starNumber;
    const halfFilled = !filled && rating >= starNumber - 0.5;

    const starChar = filled ? '★' : halfFilled ? '★' : '☆';
    const starColor = filled || halfFilled ? COLORS.star : COLORS.starEmpty;
    const opacity = halfFilled ? 0.6 : 1;

    const starElement = (
      <Text
        key={index}
        style={[styles.star, { fontSize: size, color: starColor, opacity }]}
      >
        {starChar}
      </Text>
    );

    if (interactive && onRate) {
      return (
        <TouchableOpacity key={index} onPress={() => onRate(starNumber)} activeOpacity={0.6}>
          {starElement}
        </TouchableOpacity>
      );
    }

    return starElement;
  };

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
      {showValue && (
        <Text style={[styles.value, { fontSize: size * 0.7 }]}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  star: {
    lineHeight: undefined,
  },
  value: {
    color: COLORS.textSecondary,
    marginStart: 6,
    fontWeight: '600',
  },
});
