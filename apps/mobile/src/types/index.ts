/**
 * Types -- tipusim
 * Re-exports shared types from @mooviz/shared package.
 */

// Re-export shared types when package is available
// export * from '@mooviz/shared';

// Local type definitions used across the mobile app

export type UserRole = 'sender' | 'driver';
export type ActiveMode = 'client' | 'driver';
export type KycStatus = 'pending' | 'approved' | 'rejected';
export type UserStatus = 'active' | 'suspended' | 'blocked';

export type DeliveryStatus =
  | 'new'
  | 'pending'
  | 'waiting'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'completed_paid';

export type ItemSize = 'small' | 'medium' | 'large';

export interface UserRating {
  average: number;
  count: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
  geohash: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  address: string;
  geohash?: string;
}

export interface User {
  uid: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  profilePhotoURL: string | null;
  profilePhotoPath?: string | null;
  role: UserRole;
  activeMode: ActiveMode;
  driverAvailable: boolean;
  driverUnlocked: boolean;
  city: string | null;
  kycStatus: KycStatus;
  kycDocumentURL: string | null;
  kycIdURL: string | null;
  ratingAsDriver: UserRating;
  ratingAsSender: UserRating;
  completedDeliveries: number;
  status: UserStatus;
  fcmTokens: string[];
  location: UserLocation;
  gender?: 'male' | 'female' | '';
  ageRange?: string;
  migratedFrom?: string;
  acceptedTermsAt?: Date;
  lastOtpAt?: Date;
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
  mediaURLs?: string[];
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
  type: 'text' | 'image' | 'system';
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
