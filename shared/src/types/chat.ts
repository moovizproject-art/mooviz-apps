import { Timestamp } from "./timestamp";

export type ChatMessageType = "text" | "image" | "system";

export interface ChatMessage {
  id?: string;
  senderId: string;
  text?: string;
  imageURL?: string;
  type: ChatMessageType;
  createdAt: Timestamp;
}

export interface ChatRoom {
  id?: string;
  deliveryId: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  createdAt: Timestamp;
}
