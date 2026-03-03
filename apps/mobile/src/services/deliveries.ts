/**
 * Deliveries Service — שירות משלוחים
 * Firestore delivery CRUD operations.
 * פעולות CRUD למשלוחים ב-Firestore
 */

import firestore from '@react-native-firebase/firestore';
import { encodeGeohash, getGeohashRange } from './geohash';
import { GEOHASH_PRECISION } from '../constants/config';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface DeliveryDoc {
  senderId: string;
  driverId?: string;
  status: DeliveryStatusType;
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
    geohash: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  itemDescription: string;
  itemSize: 'small' | 'medium' | 'large';
  photoUrl?: string;
  suggestedPrice: number;
  scheduledDate?: string;
  notes?: string;
  interestedDrivers: string[];
  chatId?: string;
  statusHistory: Record<string, Date>;
  rated: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

type DeliveryStatusType =
  | 'pending'
  | 'matched'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

const COLLECTION = 'deliveries';

// ──────────────────────────────────────────────
// Create
// ──────────────────────────────────────────────

/**
 * Create a new delivery request.
 * יצירת בקשת משלוח חדשה
 */
export async function createDelivery(data: {
  senderId: string;
  pickup: { latitude: number; longitude: number; address: string };
  destination: { latitude: number; longitude: number; address: string };
  itemDescription: string;
  itemSize: string;
  photoUrl?: string;
  suggestedPrice: number;
  scheduledDate?: string;
  notes?: string;
}): Promise<string> {
  const geohash = encodeGeohash(data.pickup.latitude, data.pickup.longitude, GEOHASH_PRECISION);

  const doc = {
    senderId: data.senderId,
    status: 'pending' as DeliveryStatusType,
    pickup: {
      ...data.pickup,
      geohash,
    },
    destination: data.destination,
    itemDescription: data.itemDescription,
    itemSize: data.itemSize,
    photoUrl: data.photoUrl || null,
    suggestedPrice: data.suggestedPrice,
    scheduledDate: data.scheduledDate || null,
    notes: data.notes || null,
    interestedDrivers: [],
    statusHistory: {
      pending: firestore.FieldValue.serverTimestamp(),
    },
    rated: false,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };

  const ref = await firestore().collection(COLLECTION).add(doc);
  return ref.id;
}

// ──────────────────────────────────────────────
// Read
// ──────────────────────────────────────────────

/**
 * Get a single delivery by ID.
 * שליפת משלוח בודד לפי מזהה
 */
export async function getDelivery(deliveryId: string): Promise<DeliveryDoc | null> {
  const doc = await firestore().collection(COLLECTION).doc(deliveryId).get();
  if (!doc.exists) return null;
  return { ...doc.data() } as DeliveryDoc;
}

/**
 * Query deliveries by sender.
 * שאילתת משלוחים לפי שולח
 */
export async function getDeliveriesBySender(
  senderId: string,
  statusFilter?: DeliveryStatusType[],
): Promise<{ id: string; data: DeliveryDoc }[]> {
  let query = firestore()
    .collection(COLLECTION)
    .where('senderId', '==', senderId);

  if (statusFilter && statusFilter.length > 0) {
    query = query.where('status', 'in', statusFilter);
  }

  const snapshot = await query.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as DeliveryDoc }));
}

/**
 * Query nearby deliveries using geohash.
 * שאילתת משלוחים קרובים באמצעות geohash
 */
export async function getNearbyDeliveries(
  latitude: number,
  longitude: number,
  radiusKm: number,
): Promise<{ id: string; data: DeliveryDoc }[]> {
  const { lower, upper } = getGeohashRange(latitude, longitude, radiusKm);

  const snapshot = await firestore()
    .collection(COLLECTION)
    .where('status', '==', 'pending')
    .where('pickup.geohash', '>=', lower)
    .where('pickup.geohash', '<=', upper)
    .orderBy('pickup.geohash')
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as DeliveryDoc }));
}

// ──────────────────────────────────────────────
// Update
// ──────────────────────────────────────────────

/**
 * Update delivery status.
 * עדכון סטטוס משלוח
 */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatusType,
  additionalData?: Record<string, unknown>,
): Promise<void> {
  await firestore()
    .collection(COLLECTION)
    .doc(deliveryId)
    .update({
      status,
      [`statusHistory.${status}`]: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      ...additionalData,
    });
}

/**
 * Assign a driver to a delivery (match).
 * שיוך נהג למשלוח (התאמה)
 */
export async function matchDriver(
  deliveryId: string,
  driverId: string,
  chatId: string,
): Promise<void> {
  await updateDeliveryStatus(deliveryId, 'matched', {
    driverId,
    chatId,
  });
}

/**
 * Cancel a delivery.
 * ביטול משלוח
 */
export async function cancelDelivery(deliveryId: string): Promise<void> {
  await updateDeliveryStatus(deliveryId, 'cancelled');
}
