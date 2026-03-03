import { firestore } from "firebase-admin";

export type ChatMessageType = "text" | "image" | "system";

export interface ChatMessage {
  id?: string;
  senderId: string;
  text?: string;
  imageURL?: string;
  type: ChatMessageType;
  createdAt: firestore.Timestamp;
}

export interface ChatRoom {
  id?: string;
  deliveryId: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: firestore.Timestamp;
  createdAt: firestore.Timestamp;
}
