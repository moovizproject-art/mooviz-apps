import { useCallback, useMemo } from 'react';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

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
  mediaURLs?: string[];
  suggestedPrice: number;
  scheduledDate?: string | null;
  notes?: string;
  chatId?: string;
  rated?: boolean;
  distance?: number;
  payment?: {
    senderConfirmed: boolean;
    driverConfirmed: boolean;
  };
  proof?: {
    pickupURL?: string;
    deliveryURL?: string;
    paymentURL?: string;
  };
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
  senderName?: string;
  senderPhotoUrl?: string | null;
  senderRating?: number;
  pickup: { latitude: number; longitude: number; address: string };
  destination: { latitude: number; longitude: number; address: string };
  itemDescription: string;
  itemSize: string;
  photoUri?: string | null;
  mediaUris?: string[];
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
  confirmPayment: (deliveryId: string, paymentPhotoURL?: string) => Promise<void>;
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

  // Skip server-side orderBy when using compound where clauses (driver feed)
  // to avoid requiring composite indexes — sort client-side instead
  const needsCompoundQuery = (whereClauses?.length ?? 0) > 1;

  const { data: rawData, isLoading, refresh } = useFirestore<Delivery>({
    collection: 'deliveries',
    where: whereClauses,
    orderBy: needsCompoundQuery ? undefined : ['createdAt', 'desc'],
    limit: 50,
    enabled: true,
  });

  // Client-side sort when we skipped server orderBy
  const data = useMemo(() => {
    if (!needsCompoundQuery) return rawData;
    return [...rawData].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
      return bTime - aTime;
    });
  }, [rawData, needsCompoundQuery]);

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

      // Upload media files to Storage if provided
      let photoUrl: string | null = null;
      let mediaURLs: string[] = [];

      if (input.mediaUris && input.mediaUris.length > 0) {
        try {
          const { uploadDeliveryMedia } = require('../services/storage');
          mediaURLs = await uploadDeliveryMedia(input.senderId, input.mediaUris);
          // Backward compat: first image URL as photoUrl
          photoUrl = mediaURLs[0] || null;
        } catch (err) {
          console.warn('[useDelivery] Media upload failed, continuing without media:', err);
        }
      } else if (input.photoUri) {
        // Legacy single photo support
        try {
          const { uploadImage } = require('../services/storage');
          const path = `deliveries/${input.senderId}/${Date.now()}.jpg`;
          photoUrl = await uploadImage(input.photoUri, path);
          mediaURLs = photoUrl ? [photoUrl] : [];
        } catch (err) {
          console.warn('[useDelivery] Photo upload failed, continuing without photo:', err);
        }
      }

      const now = firestore.FieldValue.serverTimestamp();
      const deliveryData = {
        senderId: input.senderId,
        senderName: input.senderName || '',
        senderPhotoUrl: input.senderPhotoUrl || null,
        senderRating: input.senderRating ?? 0,
        driverId: null,
        status: 'new',
        pickup: {
          ...input.pickup,
          geohash: pickupGeohash,
        },
        destination: input.destination,
        itemDescription: input.itemDescription,
        itemSize: input.itemSize,
        photoUrl,
        mediaURLs,
        suggestedPrice: input.suggestedPrice,
        scheduledDate: input.scheduledDate,
        notes: input.notes,
        payment: { senderConfirmed: false, driverConfirmed: false },
        proof: {},
        statusHistory: [{ status: 'new', timestamp: new Date().toISOString() }],
        interestedDrivers: [],
        createdAt: now,
        updatedAt: now,
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
    async (deliveryId: string, _driverId: string): Promise<void> => {
      // Route through Cloud Function for proper status transition + notifications
      const fn = functions().httpsCallable('expressInterest');
      await fn({ deliveryId });
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

  const confirmPayment = useCallback(async (deliveryId: string, paymentPhotoURL?: string) => {
    // All payment confirmations MUST go through Cloud Functions for server-side validation
    const fn = functions().httpsCallable('confirmPayment');
    await fn({ deliveryId, paymentPhotoURL });
  }, []);

  return {
    deliveries: data,
    isLoading,
    refresh,
    getDeliveryById,
    createDelivery,
    updateDeliveryStatus,
    expressInterest,
    submitRating,
    confirmPayment,
  };
}

// Type import for where clauses
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
