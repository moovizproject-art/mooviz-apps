import { firestore } from "firebase-admin";

export interface Rating {
  id?: string;
  deliveryId: string;
  fromUserId: string;
  toUserId: string;
  score: number; // 1-5
  comment?: string;
  createdAt: firestore.Timestamp;
}

export interface RatingCreateData {
  deliveryId: string;
  toUserId: string;
  score: number;
  comment?: string;
}
