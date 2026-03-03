/**
 * Types — טיפוסים
 * Re-exports shared types from @mooviz/shared package.
 * ייצוא מחדש של טיפוסים משותפים מחבילת @mooviz/shared
 */

// Re-export shared types when package is available
// export * from '@mooviz/shared';

// Local type definitions used across the mobile app
// הגדרות טיפוסים מקומיות בשימוש באפליקציה

export type UserRole = 'sender' | 'driver' | 'both';

export type DeliveryStatus =
  | 'pending'
  | 'matched'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type ItemSize = 'small' | 'medium' | 'large';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  address: string;
  geohash?: string;
}

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: UserRole;
  city: string | null;
  rating: number | null;
  totalDeliveries: number;
  totalRatings: number;
  kycVerified: boolean;
  fcmTokens?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface Delivery {
  id: string;
  senderId: string;
  driverId?: string;
  status: DeliveryStatus;
  pickup: GeoPoint;
  destination: GeoPoint;
  itemDescription: string;
  itemSize: ItemSize;
  photoUrl?: string;
  suggestedPrice: number;
  scheduledDate?: string;
  notes?: string;
  interestedDrivers: string[];
  chatId?: string;
  statusHistory: Record<DeliveryStatus, Date>;
  rated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image';
  imageUrl?: string;
  read: boolean;
  createdAt: Date;
}

export interface Chat {
  id: string;
  participants: string[];
  deliveryId: string;
  lastMessage: string;
  lastMessageAt: Date;
  lastSenderId: string;
  createdAt: Date;
}

export interface Rating {
  id: string;
  deliveryId: string;
  fromUserId: string;
  targetUserId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface NotificationPayload {
  type: 'delivery_update' | 'new_message' | 'new_interest' | 'rating_received';
  deliveryId?: string;
  chatId?: string;
  title: string;
  body: string;
}
