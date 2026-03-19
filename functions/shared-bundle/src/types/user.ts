import { Timestamp } from "./timestamp";

export type UserRole = "sender" | "driver";
export type ActiveMode = "client" | "driver";
export type KycStatus = "pending" | "approved" | "rejected";
export type UserStatus = "active" | "suspended" | "blocked";

export interface UserRating {
  average: number;
  count: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
  geohash: string;
}

export interface User {
  uid: string;
  fullName: string;
  nickname?: string;
  phone: string; // E.164
  email?: string;
  city: string;
  role: UserRole;
  activeMode: ActiveMode;
  driverAvailable: boolean;
  driverUnlocked: boolean;
  profilePhotoURL: string;
  kycDocumentURL: string;
  kycStatus: KycStatus;
  ratingAsDriver: UserRating;
  ratingAsSender: UserRating;
  completedDeliveries: number;
  status: UserStatus;
  fcmTokens: string[];
  location: UserLocation;
  migratedFrom?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserCreateData {
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  profilePhotoURL?: string;
  kycDocumentURL?: string;
}

export interface UserUpdateData {
  fullName?: string;
  nickname?: string;
  email?: string;
  city?: string;
  activeMode?: ActiveMode;
  driverAvailable?: boolean;
  driverUnlocked?: boolean;
  profilePhotoURL?: string;
  kycDocumentURL?: string;
  kycStatus?: KycStatus;
  fcmTokens?: string[];
  location?: UserLocation;
  migratedFrom?: string;
}
