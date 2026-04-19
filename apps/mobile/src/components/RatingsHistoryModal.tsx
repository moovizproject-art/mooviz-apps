/**
 * RatingsHistoryModal — היסטוריית דירוגים
 * Shows a paginated list of ratings received by a user, with delivery route info.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';

const STAR_GOLD = '#FFB800';
const PAGE_SIZE = 20;

interface RatingDoc {
  id: string;
  deliveryId: string;
  fromUserId: string;
  targetUserId: string;
  rating: number;
  comment?: string;
  role: 'sender' | 'driver';
  createdAt: FirebaseFirestoreTypes.Timestamp;
  // Enriched after fetch
  pickupCity?: string;
  destinationCity?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  mode: 'sender' | 'driver';
}

export function RatingsHistoryModal({ visible, onClose, userId, mode }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [ratings, setRatings] = useState<RatingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<FirebaseFirestoreTypes.QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchDeliveryRoutes = useCallback(async (ratingDocs: RatingDoc[]): Promise<RatingDoc[]> => {
    const deliveryIds = [...new Set(ratingDocs.map((r) => r.deliveryId).filter(Boolean))];
    if (deliveryIds.length === 0) return ratingDocs;

    const routeMap: Record<string, { pickup?: string; destination?: string }> = {};

    // Fetch in batches of 10 (Firestore 'in' query limit)
    for (let i = 0; i < deliveryIds.length; i += 10) {
      const batch = deliveryIds.slice(i, i + 10);
      try {
        const snap = await firestore()
          .collection('deliveries')
          .where(firestore.FieldPath.documentId(), 'in', batch)
          .get();
        snap.docs.forEach((doc) => {
          const data = doc.data();
          routeMap[doc.id] = {
            pickup: data.pickup?.city || data.pickup?.address || '',
            destination: data.destination?.city || data.destination?.address || '',
          };
        });
      } catch {
        // Silently skip failed batches
      }
    }

    return ratingDocs.map((r) => ({
      ...r,
      pickupCity: routeMap[r.deliveryId]?.pickup,
      destinationCity: routeMap[r.deliveryId]?.destination,
    }));
  }, []);

  const loadRatings = useCallback(async (isLoadMore = false) => {
    if (!userId) return;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setRatings([]);
      setLastDoc(null);
      setHasMore(true);
    }

    try {
      // mode='sender' → show ratings received as sender (given by drivers, role='driver')
      // mode='driver' → show ratings received as driver (given by senders, role='sender')
      const raterRole = mode === 'sender' ? 'driver' : 'sender';
      let query = firestore()
        .collection('ratings')
        .where('targetUserId', '==', userId)
        .where('role', '==', raterRole)
        .orderBy('createdAt', 'desc')
        .limit(PAGE_SIZE);

      if (isLoadMore && lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snap = await query.get();
      const docs: RatingDoc[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as RatingDoc));

      const enriched = await fetchDeliveryRoutes(docs);

      if (isLoadMore) {
        setRatings((prev) => [...prev, ...enriched]);
      } else {
        setRatings(enriched);
      }

      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);

      // Compute average from all loaded ratings (first page gives good approximation)
      if (!isLoadMore && docs.length > 0) {
        const sum = docs.reduce((acc, r) => acc + r.rating, 0);
        setAverageRating(sum / docs.length);
        setTotalCount(docs.length);
      } else if (!isLoadMore) {
        setAverageRating(0);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('[RatingsHistoryModal] Error loading ratings:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, mode, lastDoc, fetchDeliveryRoutes]);

  useEffect(() => {
    if (visible && userId) {
      loadRatings(false);
    }
  }, [visible, userId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadRatings(true);
    }
  }, [loadingMore, hasMore, loadRatings]);

  const formatDate = useCallback((timestamp: FirebaseFirestoreTypes.Timestamp): string => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    try {
      return date.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date.toLocaleDateString();
    }
  }, []);

  const renderStars = useCallback((rating: number, size = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={{ fontSize: size, color: i <= rating ? STAR_GOLD : '#D1D5DB' }}>
          {i <= rating ? '\u2605' : '\u2606'}
        </Text>,
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  }, []);

  const renderRatingCard = useCallback(({ item }: { item: RatingDoc }) => {
    const hasRoute = item.pickupCity && item.destinationCity;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          {renderStars(item.rating)}
          <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        {hasRoute && (
          <View style={styles.routeRow}>
            <Text style={[styles.routeText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.pickupCity} {'\u2190'} {item.destinationCity}
            </Text>
          </View>
        )}
        {item.comment ? (
          <Text style={[styles.commentText, { color: colors.textPrimary }]}>
            &quot;{item.comment}&quot;
          </Text>
        ) : (
          <Text style={[styles.noCommentText, { color: colors.textSecondary }]}>
            {t('rating.noComment')}
          </Text>
        )}
      </View>
    );
  }, [colors, renderStars, formatDate]);

  const renderHeader = () => (
    <View style={[styles.summaryHeader, { backgroundColor: colors.primary }]}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'sender' ? `📦 ${t('rating.asSender')}` : `🚗 ${t('rating.asDriver')}`}
        </Text>
        <View style={styles.closeButtonPlaceholder} />
      </View>

      <View style={styles.averageContainer}>
        <Text style={styles.averageValue}>
          {averageRating > 0 ? averageRating.toFixed(1) : '—'}
        </Text>
        {renderStars(Math.round(averageRating), 24)}
        <Text style={styles.totalCountText}>
          {totalCount > 0 ? `${totalCount} ${t('profile.ratingsCount')}` : ''}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>☆</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('rating.noRatingsYet')}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={ratings}
            keyExtractor={(item) => item.id}
            renderItem={renderRatingCard}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButtonPlaceholder: {
    width: 36,
  },
  averageContainer: {
    alignItems: 'center',
  },
  averageValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  totalCountText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  routeRow: {
    marginBottom: 8,
  },
  routeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    writingDirection: 'rtl',
  },
  noCommentText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    color: '#D1D5DB',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
