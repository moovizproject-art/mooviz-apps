import { firestore } from "firebase-admin";

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
  timestamp: firestore.Timestamp;
  actor: string;
  note?: string;
}

export interface Delivery {
  id?: string;
  senderId: string;
  driverId?: string;
  status: DeliveryStatus;
  pickup: GeoPoint;
  destination: GeoPoint;
  item: DeliveryItem;
  price: number;
  pickupDate: firestore.Timestamp | "asap";
  notes?: string;
  payment: PaymentConfirmation;
  proof: DeliveryProof;
  statusHistory: StatusEntry[];
  cancelledBy?: string;
  timeoutAt: firestore.Timestamp;
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
}

export interface DeliveryCreateData {
  pickup: GeoPoint;
  destination: GeoPoint;
  item: DeliveryItem;
  price: number;
  pickupDate: firestore.Timestamp | "asap";
  notes?: string;
}
