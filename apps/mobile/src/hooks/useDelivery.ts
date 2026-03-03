import { useCallback, useMemo } from 'react';
import firestore from '@react-native-firebase/firestore';

import { useFirestore } from './useFirestore';
import { encodeGeohash, getGeohashRange } from '../services/geohash';
import { GEOHASH_PRECISION } from '../constants/config';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface Delivery {
  id: string;
  senderId: string;
  senderName?: string;
  senderPhotoUrl?: string;
  senderRating?: number;
  driverId?: string;
  driverName?: string;
  driverPhotoUrl?: string;
  driverRating?: number;
  status: string;
  pickup?: {
    latitude: number;
    longitude: number;
    address: string;
    geohash?: string;
  };
  destination?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  itemDescription: string;
  itemSize?: string;
  photoUrl?: string;
  suggestedPrice: number;
  scheduledDate?: string | null;
  notes?: string;
  chatId?: string;
  rated?: boolean;
  distance?: number;
  createdAt?: Date | string;
}

interface UseDeliveryOptions {
  userId?: string;
  role?: 'sender' | 'driver';
  statusFilter?: string[];
  nearLocation?: { latitude: number; longitude: number };
  radiusKm?: number;
}

interface CreateDeliveryInput {
  senderId: string;
  pickup: { latitude: number; longitude: number; address: string };
  destination: { latitude: number; longitude: number; address: string };
  itemDescription: string;
  itemSize: string;
  photoUri: string | null;
  suggestedPrice: number;
  scheduledDate: string | null;
  notes: string;
}

interface RatingInput {
  deliveryId: string;
  targetUserId: string;
  rating: number;
  comment?: string;
}

interface UseDeliveryResult {
  deliveries: Delivery[];
  isLoading: boolean;
  refresh: () => void;
  getDeliveryById: (id: string) => Delivery | undefined;
  createDelivery: (input: CreateDeliveryInput) => Promise<string>;
  updateDeliveryStatus: (deliveryId: string, status: string) => Promise<void>;
  expressInterest: (deliveryId: string, driverId: string) => Promise<void>;
  submitRating: (input: RatingInput) => Promise<void>;
}

/**
 * useDelivery — הוק משלוחים
 * Delivery CRUD operations with Firestore.
 * פעולות CRUD למשלוחים עם Firestore
 */
export function useDelivery(options?: UseDeliveryOptions): UseDeliveryResult {
  // Build where clauses based on options
  const whereClauses = useMemo(() => {
    const clauses: [string, FirebaseFirestoreTypes.WhereFilterOp, unknown][] = [];

    if (options?.userId && options?.role === 'sender') {
      clauses.push(['senderId', '==', options.userId]);
    }
    if (options?.userId && options?.role === 'driver') {
      clauses.push(['driverId', '==', options.userId]);
    }
    if (options?.statusFilter && options.statusFilter.length > 0) {
      clauses.push(['status', 'in', options.statusFilter]);
    }

    // Geohash-based proximity filter for driver feed
    if (options?.nearLocation && options?.radiusKm) {
      const { lower, upper } = getGeohashRange(
        options.nearLocation.latitude,
        options.nearLocation.longitude,
        options.radiusKm,
      );
      clauses.push(['pickup.geohash', '>=', lower]);
      clauses.push(['pickup.geohash', '<=', upper]);
    }

    return clauses.length > 0 ? clauses : undefined;
  }, [options?.userId, options?.role, options?.statusFilter, options?.nearLocation, options?.radiusKm]);

  const { data, isLoading, refresh } = useFirestore<Delivery>({
    collection: 'deliveries',
    where: whereClauses,
    orderBy: ['createdAt', 'desc'],
    limit: 50,
    enabled: true,
  });

  const getDeliveryById = useCallback(
    (id: string): Delivery | undefined => {
      return data.find((d) => d.id === id);
    },
    [data],
  );

  const createDelivery = useCallback(
    async (input: CreateDeliveryInput): Promise<string> => {
      const pickupGeohash = encodeGeohash(
        input.pickup.latitude,
        input.pickup.longitude,
        GEOHASH_PRECISION,
      );

      const deliveryData = {
        senderId: input.senderId,
        status: 'pending',
        pickup: {
          ...input.pickup,
          geohash: pickupGeohash,
        },
        destination: input.destination,
        itemDescription: input.itemDescription,
        itemSize: input.itemSize,
        photoUri: input.photoUri,
        suggestedPrice: input.suggestedPrice,
        scheduledDate: input.scheduledDate,
        notes: input.notes,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await firestore().collection('deliveries').add(deliveryData);
      return docRef.id;
    },
    [],
  );

  const updateDeliveryStatus = useCallback(
    async (deliveryId: string, status: string): Promise<void> => {
      await firestore().collection('deliveries').doc(deliveryId).update({
        status,
        [`statusHistory.${status}`]: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [],
  );

  const expressInterest = useCallback(
    async (deliveryId: string, driverId: string): Promise<void> => {
      // Add driver to interested array
      // הוספת נהג לרשימת המעוניינים
      await firestore().collection('deliveries').doc(deliveryId).update({
        interestedDrivers: firestore.FieldValue.arrayUnion(driverId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [],
  );

  const submitRating = useCallback(
    async (input: RatingInput): Promise<void> => {
      const batch = firestore().batch();

      // Create rating document
      const ratingRef = firestore().collection('ratings').doc();
      batch.set(ratingRef, {
        deliveryId: input.deliveryId,
        targetUserId: input.targetUserId,
        rating: input.rating,
        comment: input.comment || null,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Mark delivery as rated
      const deliveryRef = firestore().collection('deliveries').doc(input.deliveryId);
      batch.update(deliveryRef, { rated: true });

      await batch.commit();
    },
    [],
  );

  return {
    deliveries: data,
    isLoading,
    refresh,
    getDeliveryById,
    createDelivery,
    updateDeliveryStatus,
    expressInterest,
    submitRating,
  };
}

// Type import for where clauses
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
