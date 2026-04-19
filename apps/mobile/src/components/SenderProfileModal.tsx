import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { AvatarCircle } from './AvatarCircle';
import { RatingsHistoryModal } from './RatingsHistoryModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  senderUid: string;
  senderName: string;
  senderPhotoUrl: string | null;
  senderRating: number;
  senderCompletedDeliveries: number;
}

interface ReviewDoc {
  id: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export function SenderProfileModal({
  visible, onClose, senderUid, senderName, senderPhotoUrl,
  senderRating, senderCompletedDeliveries,
}: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [memberSince, setMemberSince] = useState<string>('');
  const [completedCount, setCompletedCount] = useState(senderCompletedDeliveries);
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false);

  useEffect(() => {
    if (!visible || !senderUid) return;
    setLoadingReviews(true);

    // Fetch reviews where drivers rated this sender (role='driver')
    const ratingsRef = firestore().collection('ratings');
    const q = ratingsRef
      .where('targetUserId', '==', senderUid)
      .where('role', '==', 'driver')
      .orderBy('createdAt', 'desc')
      .limit(2);

    Promise.all([
      q.get(),
      ratingsRef.where('targetUserId', '==', senderUid).where('role', '==', 'driver').count().get(),
    ]).then(([snap, countSnap]) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewDoc)));
      setTotalReviews(countSnap.data().count);
    }).catch(() => {}).finally(() => setLoadingReviews(false));

    // Fetch member since date
    firestore().collection('users').doc(senderUid).get().then((snap) => {
      if (snap.exists) {
        const ts = snap.data()?.createdAt;
        if (ts?.toDate) {
          setMemberSince(ts.toDate().toLocaleDateString('he-IL', { month: 'short', year: 'numeric' }));
        }
        setCompletedCount(snap.data()?.completedDeliveries ?? 0);
      }
    }).catch(() => {});
  }, [visible, senderUid]);

  const renderStars = (rating: number) => (
    <Text style={styles.stars}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </Text>
  );

  const formatDate = (ts: any): string => {
    if (!ts?.toDate) return '';
    try { return ts.toDate().toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }); }
    catch { return ''; }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <AvatarCircle name={senderName} photoUrl={senderPhotoUrl} size={72} />
          <Text style={styles.headerName}>{senderName}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FFB800' }]}>
              {senderRating > 0 ? senderRating.toFixed(1) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('profile.rating')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#1a73e8' }]}>{completedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('profile.deliveries')}</Text>
          </View>
          {memberSince ? (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#22c55e', fontSize: 14 }]}>{memberSince}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('profile.memberSince')}</Text>
              </View>
            </>
          ) : null}
        </View>

        <ScrollView style={styles.reviewsSection} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={[styles.reviewsTitle, { color: colors.textPrimary }]}>{t('profile.recentReviews')}</Text>

          {loadingReviews ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : reviews.length === 0 ? (
            <Text style={[styles.noReviews, { color: colors.textSecondary }]}>{t('profile.noReviews')}</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  {renderStars(review.rating)}
                  <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>{formatDate(review.createdAt)}</Text>
                </View>
                {review.comment ? (
                  <Text style={[styles.reviewComment, { color: colors.textPrimary }]} numberOfLines={3}>
                    &quot;{review.comment}&quot;
                  </Text>
                ) : (
                  <Text style={[styles.noComment, { color: colors.textSecondary }]}>{t('profile.noComment')}</Text>
                )}
              </View>
            ))
          )}

          {totalReviews > 2 && (
            <TouchableOpacity onPress={() => setRatingsModalVisible(true)} style={styles.showAllBtn}>
              <Text style={styles.showAllText}>{t('profile.showAllReviews', { count: totalReviews })} ←</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <RatingsHistoryModal
        visible={ratingsModalVisible}
        onClose={() => setRatingsModalVisible(false)}
        userId={senderUid}
        mode="sender"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: '#1a73e8', paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 24, alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  closeBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, left: 16,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  headerName: { color: '#FFF', fontSize: 20, fontWeight: '700', marginTop: 10 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 20,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 36 },
  reviewsSection: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  reviewsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  noReviews: { fontSize: 14, textAlign: 'center', marginTop: 20 },
  reviewCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stars: { fontSize: 14, color: '#FFB800' },
  reviewDate: { fontSize: 11 },
  reviewComment: { fontSize: 13, fontStyle: 'italic', writingDirection: 'rtl' },
  noComment: { fontSize: 12, fontStyle: 'italic' },
  showAllBtn: { alignItems: 'center', paddingVertical: 10 },
  showAllText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
});
