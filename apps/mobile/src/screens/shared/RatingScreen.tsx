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
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
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
  const { colors } = useTheme();
  const { t } = useI18n();
  const { submitRating } = useDelivery();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    if (rating === 0) {
      Alert.alert('', t('rating.selectRating'));
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
      Alert.alert(t('rating.thanks'), t('rating.ratingSuccess'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('', t('rating.ratingError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('rating.howWasIt')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('rating.rateExperience')}</Text>

        {/* Star rating */}
        <View style={styles.starsRow}>
          {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starButton}>
              <Text style={[styles.star, { color: colors.border }, star <= rating && styles.starActive]}>
                {star <= rating ? '\u2605' : '\u2606'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rating labels */}
        {rating > 0 && (
          <Text style={[styles.ratingLabel, { color: colors.primary }]}>
            {rating === 1 && t('rating.poor')}
            {rating === 2 && t('rating.notGood')}
            {rating === 3 && t('rating.ok')}
            {rating === 4 && t('rating.good')}
            {rating === 5 && t('rating.excellent')}
          </Text>
        )}

        {/* Comment input */}
        <View style={styles.commentSection}>
          <Text style={[styles.commentLabel, { color: colors.textPrimary }]}>{t('rating.addComment')}</Text>
          <TextInput
            style={[styles.commentInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={comment}
            onChangeText={setComment}
            placeholder={t('rating.commentPlaceholder')}
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlign="right"
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || rating === 0}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? t('rating.submitting') : t('rating.submitRating')}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity style={styles.skipButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>{t('rating.skip')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
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
  },
  starActive: {
    color: '#FFB800',
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  commentSection: {
    width: '100%',
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
  },
  submitButton: {
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
  },
});
