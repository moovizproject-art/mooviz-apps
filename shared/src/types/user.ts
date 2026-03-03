import { firestore } from "firebase-admin";

export type UserRole = "sender" | "driver";
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
  phone: string; // E.164
  email?: string;
  city: string;
  role: UserRole;
  profilePhotoURL: string;
  kycDocumentURL: string;
  kycStatus: KycStatus;
  rating: UserRating;
  completedDeliveries: number;
  status: UserStatus;
  fcmToken: string;
  location: UserLocation;
  createdAt: firestore.Timestamp;
}

export interface UserCreateData {
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  role: UserRole;
  profilePhotoURL?: string;
  kycDocumentURL?: string;
}

export interface UserUpdateData {
  fullName?: string;
  email?: string;
  city?: string;
  profilePhotoURL?: string;
  kycDocumentURL?: string;
  fcmToken?: string;
  location?: UserLocation;
}
