import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type DeliveryStatus =
  | 'new'
  | 'accepted'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'confirmed'
  | 'cancelled'
  | 'disputed';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  geohash: string;
  address: string;
  city: string;
}

export interface StatusEvent {
  status: DeliveryStatus;
  timestamp: Timestamp;
  note?: string;
  updatedBy: string;
}

export interface Delivery {
  id: string;
  senderId: string;
  senderName: string;
  driverId: string | null;
  driverName: string | null;
  title: string;
  description: string;
  pickup: GeoPoint;
  destination: GeoPoint;
  status: DeliveryStatus;
  price: number;
  currency: string;
  proofPhotoURL: string | null;
  statusHistory: StatusEvent[];
  chatId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deliveredAt: Timestamp | null;
}

export interface DeliveriesQueryParams {
  status?: DeliveryStatus;
  city?: string;
  dateFrom?: Date;
  dateTo?: Date;
  pageSize?: number;
  lastDoc?: DocumentSnapshot;
}

const deliveriesRef = collection(db, 'deliveries');

export async function getDeliveries(params: DeliveriesQueryParams = {}): Promise<{
  deliveries: Delivery[];
  lastDoc: DocumentSnapshot | null;
}> {
  const constraints = [];

  if (params.status) {
    constraints.push(where('status', '==', params.status));
  }
  if (params.city) {
    constraints.push(where('pickup.city', '==', params.city));
  }
  if (params.dateFrom) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(params.dateFrom)));
  }
  if (params.dateTo) {
    constraints.push(where('createdAt', '<=', Timestamp.fromDate(params.dateTo)));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(params.pageSize ?? 20));

  if (params.lastDoc) {
    constraints.push(startAfter(params.lastDoc));
  }

  const q = query(deliveriesRef, ...constraints);
  const snapshot = await getDocs(q);

  const deliveries = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Delivery[];

  const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;

  return { deliveries, lastDoc };
}

export async function getDeliveryById(deliveryId: string): Promise<Delivery | null> {
  const docSnap = await getDoc(doc(db, 'deliveries', deliveryId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Delivery;
}

export async function getUserDeliveries(
  userId: string,
  role: 'sender' | 'driver',
): Promise<Delivery[]> {
  const field = role === 'sender' ? 'senderId' : 'driverId';
  const q = query(deliveriesRef, where(field, '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Delivery[];
}

export async function cancelDelivery(deliveryId: string, reason: string): Promise<void> {
  await updateDoc(doc(db, 'deliveries', deliveryId), {
    status: 'cancelled',
    adminCancelReason: reason,
    updatedAt: Timestamp.now(),
  });
}

export async function resolveDispute(
  deliveryId: string,
  resolution: string,
  newStatus: DeliveryStatus,
): Promise<void> {
  await updateDoc(doc(db, 'deliveries', deliveryId), {
    status: newStatus,
    disputeResolution: resolution,
    disputeResolvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}
