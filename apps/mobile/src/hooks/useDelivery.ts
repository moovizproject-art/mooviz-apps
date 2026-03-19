import { useCallback, useMemo } from 'react';
import functions from '@react-native-firebase/functions';

import { useFirestore } from './useFirestore';
import { getGeohashRange } from '../services/geohash';

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
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    address: string;
    city?: string;
    geohash?: string;
  };
  destination?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    address: string;
    city?: string;
  };
  // HLD canonical fields (from callable)
  item?: { description: string; type?: string; size?: string; photoURL?: string };
  price?: number;
  pickupDate?: string | null;
  // Legacy flat fields (from old direct writes)
  itemDescription?: string;
  itemSize?: string;
  photoUrl?: string;
  mediaURLs?: string[];
  suggestedPrice?: number;
  scheduledDate?: string | null;
  notes?: string;
  chatId?: string;
  rated?: boolean;
  ratedBySender?: boolean;
  ratedByDriver?: boolean;
  ratingsVisibleAt?: Date | string | null;
  senderRatingGiven?: { rating: number; comment?: string };
  driverRatingGiven?: { rating: number; comment?: string };
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
  interestedDrivers?: Array<{
    uid: string;
    name: string;
    photoUrl: string | null;
    rating: number;
    completedDeliveries: number;
    distanceKm: number;
    expressedAt?: Date | string;
    status: string;
  }>;
  selectedDriverId?: string | null;
  selectionExpiresAt?: Date | string | null;
}

/** Get the effective price from a delivery (handles both old and new field names). */
export function getDeliveryPrice(d: Delivery): number {
  return d.price ?? d.suggestedPrice ?? 0;
}

/** Get the effective item description from a delivery. */
export function getDeliveryItemDescription(d: Delivery): string {
  return d.item?.description ?? d.itemDescription ?? '';
}

/** Get pickup latitude from a delivery (handles both field formats). */
export function getPickupLat(d: Delivery): number | undefined {
  return d.pickup?.lat ?? d.pickup?.latitude;
}

/** Get pickup longitude from a delivery (handles both field formats). */
export function getPickupLng(d: Delivery): number | undefined {
  return d.pickup?.lng ?? d.pickup?.longitude;
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
  timeRange?: string | null;
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
  withdrawInterest: (deliveryId: string) => Promise<void>;
  submitRating: (input: RatingInput) => Promise<void>;
  confirmPayment: (deliveryId: string, paymentPhotoURL?: string) => Promise<void>;
  selectDriver: (deliveryId: string, driverUid: string) => Promise<void>;
  confirmSelection: (deliveryId: string) => Promise<void>;
  declineSelection: (deliveryId: string) => Promise<void>;
  cancelSelectedDriver: (deliveryId: string) => Promise<void>;
  withdrawFromInterest: (deliveryId: string) => Promise<void>;
  cancelDelivery: (deliveryId: string, reason?: string) => Promise<void>;
}

/**
 * useDelivery — הוק משלוחים
 * Delivery CRUD operations with Firestore.
 * פעולות CRUD למשלוחים עם Firestore
 */
export function useDelivery(options?: UseDeliveryOptions): UseDeliveryResult {
  // Stabilize geohash range — only recompute when position changes significantly.
  // GPS gives slightly different floats every tick (32.0815001 vs 32.0815002).
  // Round to 4 decimal places (~11m precision) so minor drift doesn't cause
  // useMemo → new query → Firestore re-subscribe → list flicker.
  const stableLat = options?.nearLocation ? Math.round(options.nearLocation.latitude * 10000) / 10000 : 0;
  const stableLng = options?.nearLocation ? Math.round(options.nearLocation.longitude * 10000) / 10000 : 0;
  const geohashRange = useMemo(() => {
    if (!stableLat || !stableLng || !options?.radiusKm) return undefined;
    return getGeohashRange(stableLat, stableLng, options.radiusKm);
  }, [stableLat, stableLng, options?.radiusKm]);

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
    if (geohashRange) {
      clauses.push(['pickup.geohash', '>=', geohashRange.lower]);
      clauses.push(['pickup.geohash', '<=', geohashRange.upper]);
    }

    return clauses.length > 0 ? clauses : undefined;
  }, [options?.userId, options?.role, options?.statusFilter, geohashRange]);

  // Skip server-side orderBy when using compound where clauses (driver feed)
  // to avoid requiring composite indexes — sort client-side instead
  const needsCompoundQuery = (whereClauses?.length ?? 0) > 1;

  const { data: rawData, isLoading, refresh } = useFirestore<Delivery>({
    collection: 'deliveries',
    where: whereClauses,
    orderBy: needsCompoundQuery ? undefined : ['updatedAt', 'desc'],
    limit: 50,
    enabled: true,
  });

  // Client-side sort when we skipped server orderBy
  const data = useMemo(() => {
    if (!needsCompoundQuery) return rawData;
    return [...rawData].sort((a, b) => {
      const getTime = (d: any) => {
        const t = d.updatedAt || d.createdAt;
        if (!t) return 0;
        if (typeof t === 'object' && t.toDate) return t.toDate().getTime();
        if (typeof t === 'object' && t._seconds) return t._seconds * 1000;
        return new Date(t as string).getTime() || 0;
      };
      return getTime(b) - getTime(a);
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
      // Upload media files to Storage first (client-side, needs user auth)
      let photoUrl: string | null = null;
      let mediaURLs: string[] = [];

      if (input.mediaUris && input.mediaUris.length > 0) {
        try {
          const { uploadDeliveryMedia } = require('../services/storage');
          mediaURLs = await uploadDeliveryMedia(input.senderId, input.mediaUris);
          photoUrl = mediaURLs[0] || null;
        } catch (err) {
          console.warn('[useDelivery] Media upload failed, continuing without media:', err);
        }
      } else if (input.photoUri) {
        try {
          const { uploadImage } = require('../services/storage');
          const path = `deliveries/${input.senderId}/${Date.now()}.jpg`;
          photoUrl = await uploadImage(input.photoUri, path);
          mediaURLs = photoUrl ? [photoUrl] : [];
        } catch (err) {
          console.warn('[useDelivery] Photo upload failed, continuing without photo:', err);
        }
      }

      // Call Cloud Function — server handles normalization, validation, geohash, notifications
      try {
        const fn = functions().httpsCallable('createDelivery');
        const result = await fn({
          pickup: input.pickup,
          destination: input.destination,
          itemDescription: input.itemDescription,
          itemSize: input.itemSize,
          photoUrl,
          mediaURLs,
          suggestedPrice: input.suggestedPrice,
          scheduledDate: input.scheduledDate,
          timeRange: input.timeRange ?? null,
          notes: input.notes,
        });

        return (result.data as { deliveryId: string }).deliveryId;
      } catch (err) {
        console.error('[useDelivery] createDelivery failed:', err);
        throw new Error((err as any)?.message || 'Create delivery failed');
      }
    },
    [],
  );

  /**
   * @deprecated Direct status writes removed for security.
   * Use the specific callable for each transition:
   * confirmPickup, confirmDelivery, confirmPayment, cancelDelivery, etc.
   */
  const updateDeliveryStatus = useCallback(
    async (_deliveryId: string, _status: string): Promise<void> => {
      throw new Error(
        'Direct status updates are not allowed. Use the appropriate callable function (confirmPickup, confirmDelivery, confirmPayment, cancelDelivery, etc.)',
      );
    },
    [],
  );

  const expressInterest = useCallback(
    async (deliveryId: string, _driverId: string): Promise<void> => {
      try {
        // Route through Cloud Function for proper status transition + notifications
        const fn = functions().httpsCallable('expressInterest');
        await fn({ deliveryId });
      } catch (err) {
        console.error('[useDelivery] expressInterest failed:', err);
        throw new Error((err as any)?.message || 'Express interest failed');
      }
    },
    [],
  );

  const withdrawInterest = useCallback(
    async (deliveryId: string): Promise<void> => {
      try {
        const fn = functions().httpsCallable('withdrawInterest');
        await fn({ deliveryId });
      } catch (err) {
        console.error('[useDelivery] withdrawInterest failed:', err);
        throw new Error((err as any)?.message || 'Withdraw interest failed');
      }
    },
    [],
  );

  const submitRating = useCallback(
    async (input: RatingInput): Promise<void> => {
      try {
        // Route through Cloud Function for server-side validation + aggregate rating update
        const fn = functions().httpsCallable('submitRating');
        await fn({
          deliveryId: input.deliveryId,
          targetUserId: input.targetUserId,
          rating: input.rating,
          comment: input.comment || null,
        });
      } catch (err) {
        console.error('[useDelivery] submitRating failed:', err);
        throw new Error((err as any)?.message || 'Rating submission failed');
      }
    },
    [],
  );

  const selectDriver = useCallback(async (deliveryId: string, driverUid: string) => {
    try {
      const fn = functions().httpsCallable('selectDriver');
      await fn({ deliveryId, driverUid });
    } catch (err) {
      console.error('[useDelivery] selectDriver failed:', err);
      throw new Error((err as any)?.message || 'Select driver failed');
    }
  }, []);

  const confirmSelection = useCallback(async (deliveryId: string) => {
    try {
      const fn = functions().httpsCallable('confirmSelection');
      await fn({ deliveryId });
    } catch (err) {
      console.error('[useDelivery] confirmSelection failed:', err);
      throw new Error((err as any)?.message || 'Confirm selection failed');
    }
  }, []);

  const declineSelection = useCallback(async (deliveryId: string) => {
    try {
      const fn = functions().httpsCallable('declineSelection');
      await fn({ deliveryId });
    } catch (err) {
      console.error('[useDelivery] declineSelection failed:', err);
      throw new Error((err as any)?.message || 'Decline selection failed');
    }
  }, []);

  const cancelSelectedDriver = useCallback(async (deliveryId: string) => {
    try {
      const fn = functions().httpsCallable('cancelSelectedDriver');
      await fn({ deliveryId });
    } catch (err) {
      console.error('[useDelivery] cancelSelectedDriver failed:', err);
      throw new Error((err as any)?.message || 'Cancel selected driver failed');
    }
  }, []);

  const withdrawFromInterest = useCallback(async (deliveryId: string) => {
    try {
      const fn = functions().httpsCallable('withdrawFromInterest');
      await fn({ deliveryId });
    } catch (err) {
      console.error('[useDelivery] withdrawFromInterest failed:', err);
      throw new Error((err as any)?.message || 'Withdraw from interest failed');
    }
  }, []);

  const cancelDelivery = useCallback(async (deliveryId: string, reason?: string) => {
    try {
      const fn = functions().httpsCallable('cancelDelivery');
      await fn({ deliveryId, reason });
    } catch (err) {
      console.error('[useDelivery] cancelDelivery failed:', err);
      throw new Error((err as any)?.message || 'Cancel delivery failed');
    }
  }, []);

  const confirmPayment = useCallback(async (deliveryId: string, paymentPhotoURL?: string) => {
    try {
      // All payment confirmations MUST go through Cloud Functions for server-side validation
      const fn = functions().httpsCallable('confirmPayment');
      await fn({ deliveryId, paymentPhotoURL });
    } catch (err) {
      console.error('[useDelivery] confirmPayment failed:', err);
      throw new Error((err as any)?.message || 'Payment confirmation failed');
    }
  }, []);

  return {
    deliveries: data,
    isLoading,
    refresh,
    getDeliveryById,
    createDelivery,
    updateDeliveryStatus,
    expressInterest,
    withdrawInterest,
    submitRating,
    confirmPayment,
    selectDriver,
    confirmSelection,
    declineSelection,
    cancelSelectedDriver,
    withdrawFromInterest,
    cancelDelivery,
  };
}

// Type import for where clauses
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
