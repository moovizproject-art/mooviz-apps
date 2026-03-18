import { Timestamp } from "./timestamp";

export type DeliveryStatus =
  | "new"
  | "pending"
  | "waiting"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "completed_paid";

export interface GeoPoint {
  address: string;
  city: string;
  lat: number;
  lng: number;
  geohash: string;
}

export interface DeliveryItem {
  description: string;
  type: string;
  size: string;
  photoURL: string;
}

export interface PaymentConfirmation {
  senderConfirmed: boolean;
  driverConfirmed: boolean;
}

export interface DeliveryProof {
  pickupURL?: string;
  deliveryURL?: string;
  paymentURL?: string;
}

export interface StatusEntry {
  status: DeliveryStatus;
  timestamp: Timestamp;
  actor: string;
  note?: string;
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
  id?: string;
  senderId: string;
  senderName?: string;
  senderPhotoUrl?: string;
  senderRating?: number | null;
  driverId?: string;
  driverName?: string;
  driverPhotoUrl?: string;
  driverRating?: number | null;
  chatId?: string;
  status: DeliveryStatus;
  pickup: GeoPoint;
  destination: GeoPoint;
  item: DeliveryItem;
  price: number;
  pickupDate: Timestamp | "asap";
  timeRange?: string | null;
  notes?: string;
  payment: PaymentConfirmation;
  proof: DeliveryProof;
  statusHistory: StatusEntry[];
  rated?: boolean;
  ratedBySender?: boolean;
  ratedByDriver?: boolean;
  ratingsVisibleAt?: Timestamp;
  cancelledBy?: string;
  timeoutAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  interestedDrivers?: InterestedDriver[];
  selectedDriverId?: string | null;
  selectionExpiresAt?: Timestamp | null;
}

export interface DeliveryCreateData {
  pickup: GeoPoint;
  destination: GeoPoint;
  item: DeliveryItem;
  price: number;
  pickupDate: Timestamp | "asap";
  notes?: string;
}
