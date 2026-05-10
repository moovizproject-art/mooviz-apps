import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
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
  | 'pending'
  | 'awaiting_confirm'
  | 'waiting_for_pickup'
  | 'picked_up'
  | 'delivered'
  | 'awaiting_payment'
  | 'completed_paid'
  | 'cancelled';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
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

export interface DeliveryItem {
  description: string;
  type: string;
  size: string;
  photoURL: string | null;
}

export type InterestedDriverStatus = 'interested' | 'selected' | 'confirmed' | 'declined' | 'cancelled' | 'withdrawn';

export interface InterestedDriver {
  uid: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  completedDeliveries: number;
  distanceKm: number;
  expressedAt: Timestamp;
  status: InterestedDriverStatus;
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
  item: DeliveryItem | null;
  status: DeliveryStatus;
  price: number;
  currency: string;
  proof: {
    pickupURL?: string;
    deliveryURL?: string;
    paymentURL?: string;
  } | null;
  proofPhotoURL: string | null;
  statusHistory: StatusEvent[];
  interestedDrivers?: InterestedDriver[];
  notifiedDrivers?: string[];
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

function normalizeDelivery(docSnap: DocumentSnapshot): Delivery {
  const data = docSnap.data() ?? {};
  const pickup = data.pickup ?? {};
  const destination = data.destination ?? {};
  const item = data.item ?? null;

  return {
    id: docSnap.id,
    senderId: data.senderId ?? '',
    senderName: data.senderName ?? '',
    driverId: data.driverId ?? null,
    driverName: data.driverName ?? null,
    title: data.title ?? item?.description ?? 'Delivery',
    description: data.description ?? item?.description ?? '',
    pickup: {
      latitude: pickup.lat ?? pickup.latitude ?? 0,
      longitude: pickup.lng ?? pickup.longitude ?? 0,
      lat: pickup.lat ?? pickup.latitude ?? 0,
      lng: pickup.lng ?? pickup.longitude ?? 0,
      geohash: pickup.geohash ?? '',
      address: pickup.address ?? '',
      city: pickup.city ?? '',
    },
    destination: {
      latitude: destination.lat ?? destination.latitude ?? 0,
      longitude: destination.lng ?? destination.longitude ?? 0,
      lat: destination.lat ?? destination.latitude ?? 0,
      lng: destination.lng ?? destination.longitude ?? 0,
      geohash: destination.geohash ?? '',
      address: destination.address ?? '',
      city: destination.city ?? '',
    },
    item: item
      ? {
          description: item.description ?? '',
          type: item.type ?? '',
          size: item.size ?? '',
          photoURL: item.photoURL ?? null,
        }
      : null,
    status: data.status ?? 'new',
    price: data.price ?? data.suggestedPrice ?? 0,
    currency: data.currency ?? 'ILS',
    proof: data.proof ?? null,
    proofPhotoURL: data.proof?.deliveryURL ?? data.proofPhotoURL ?? null,
    statusHistory: (data.statusHistory ?? []) as StatusEvent[],
    interestedDrivers: (data.interestedDrivers ?? undefined) as InterestedDriver[] | undefined,
    notifiedDrivers: Array.isArray(data.notifiedDrivers) ? data.notifiedDrivers : undefined,
    chatId: data.chatId ?? null,
    createdAt: data.createdAt ?? Timestamp.now(),
    updatedAt: data.updatedAt ?? Timestamp.now(),
    deliveredAt: data.deliveredAt ?? null,
  };
}

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
  constraints.push(limit(params.pageSize ?? 200));

  if (params.lastDoc) {
    constraints.push(startAfter(params.lastDoc));
  }

  const q = query(deliveriesRef, ...constraints);
  const snapshot = await getDocs(q);

  const deliveries = snapshot.docs.map(normalizeDelivery);
  const lastDocSnap = snapshot.docs[snapshot.docs.length - 1] ?? null;

  return { deliveries, lastDoc: lastDocSnap };
}

export async function getDeliveryById(deliveryId: string): Promise<Delivery | null> {
  const docSnap = await getDoc(doc(db, 'deliveries', deliveryId));
  if (!docSnap.exists()) return null;
  return normalizeDelivery(docSnap);
}

export async function getUserDeliveries(
  userId: string,
  role: 'sender' | 'driver',
): Promise<Delivery[]> {
  const field = role === 'sender' ? 'senderId' : 'driverId';
  const q = query(deliveriesRef, where(field, '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(normalizeDelivery);
}

export async function getRecentDeliveries(count: number = 10): Promise<Delivery[]> {
  const q = query(deliveriesRef, orderBy('createdAt', 'desc'), limit(count));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(normalizeDelivery);
}

export async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: DeliveryStatus,
  adminId: string,
  note?: string,
): Promise<void> {
  const statusEntry: StatusEvent = {
    status: newStatus,
    timestamp: Timestamp.now(),
    updatedBy: adminId,
    note: note ?? `Admin override to ${newStatus}`,
  };

  const updates: Record<string, unknown> = {
    status: newStatus,
    statusHistory: arrayUnion(statusEntry),
    updatedAt: Timestamp.now(),
  };

  if (newStatus === 'delivered') {
    updates.deliveredAt = Timestamp.now();
  }

  await updateDoc(doc(db, 'deliveries', deliveryId), updates);
}

export async function cancelDelivery(
  deliveryId: string,
  reason: string,
  adminId?: string,
): Promise<void> {
  const statusEntry: StatusEvent = {
    status: 'cancelled',
    timestamp: Timestamp.now(),
    updatedBy: adminId ?? 'admin',
    note: `Admin cancellation: ${reason}`,
  };

  await updateDoc(doc(db, 'deliveries', deliveryId), {
    status: 'cancelled',
    adminCancelReason: reason,
    cancelledBy: adminId ?? 'admin',
    statusHistory: arrayUnion(statusEntry),
    updatedAt: Timestamp.now(),
  });
}

export async function resolveDispute(
  deliveryId: string,
  resolution: string,
  newStatus: DeliveryStatus,
  adminId?: string,
): Promise<void> {
  const statusEntry: StatusEvent = {
    status: newStatus,
    timestamp: Timestamp.now(),
    updatedBy: adminId ?? 'admin',
    note: `Dispute resolved: ${resolution}`,
  };

  await updateDoc(doc(db, 'deliveries', deliveryId), {
    status: newStatus,
    disputeResolution: resolution,
    disputeResolvedAt: Timestamp.now(),
    statusHistory: arrayUnion(statusEntry),
    updatedAt: Timestamp.now(),
  });
}
