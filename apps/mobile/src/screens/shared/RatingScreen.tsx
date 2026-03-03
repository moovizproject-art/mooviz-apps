import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useDelivery } from '../../hooks/useDelivery';

type Props = NativeStackScreenProps<RootStackParamList, 'Rating'>;

const STAR_COUNT = 5;

/**
 * RatingScreen — מסך דירוג
 * Star rating + comment after delivery completion.
 * דירוג כוכבים + תגובה לאחר השלמת משלוח
 */
export function RatingScreen({ route, navigation }: Props): React.JSX.Element {
  const { deliveryId, targetUserId } = route.params;
  const { submitRating } = useDelivery();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    if (rating === 0) {
      Alert.alert('שגיאה', 'יש לבחור דירוג'); // Select a rating
      return;
    }

    try {
      setIsSubmitting(true);
      await submitRating({
        deliveryId,
        targetUserId,
        rating,
        comment: comment.trim() || undefined,
      });
      Alert.alert('תודה!', 'הדירוג נשלח בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
      // Thanks! Rating submitted successfully
    } catch (err) {
      Alert.alert('שגיאה', 'לא ניתן לשלוח דירוג. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>איך היה?</Text>
        {/* How was it? */}
        <Text style={styles.subtitle}>דרג את חוויית המשלוח</Text>
        {/* Rate the delivery experience */}

        {/* Star rating */}
        {/* דירוג כוכבים */}
        <View style={styles.starsRow}>
          {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starButton}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>
                {star <= rating ? '\u2605' : '\u2606'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rating labels */}
        {rating > 0 && (
          <Text style={styles.ratingLabel}>
            {rating === 1 && 'גרוע'}
            {rating === 2 && 'לא טוב'}
            {rating === 3 && 'בסדר'}
            {rating === 4 && 'טוב'}
            {rating === 5 && 'מצוין!'}
            {/* Poor / Not good / OK / Good / Excellent! */}
          </Text>
        )}

        {/* Comment input */}
        {/* שדה תגובה */}
        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>הוסף תגובה (אופציונלי)</Text>
          {/* Add a comment (optional) */}
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="ספר על החוויה שלך..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlign="right"
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || rating === 0}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'שולח...' : 'שלח דירוג'}
            {/* Sending... / Submit rating */}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity style={styles.skipButton} onPress={() => navigation.goBack()}>
          <Text style={styles.skipButtonText}>דלג</Text>
          {/* Skip */}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 44,
    color: COLORS.border,
  },
  starActive: {
    color: '#FFB800',
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 24,
  },
  commentSection: {
    width: '100%',
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
