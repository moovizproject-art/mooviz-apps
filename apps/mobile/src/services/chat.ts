/**
 * Chat Service — שירות צ׳אט
 * Chat message operations with Firestore.
 * פעולות הודעות צ׳אט עם Firestore
 */

import firestore from '@react-native-firebase/firestore';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ChatDoc {
  participants: string[];
  deliveryId: string;
  lastMessage: string;
  lastMessageAt: FirebaseFirestoreTypes.Timestamp;
  lastSenderId: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface MessageDoc {
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image';
  imageUrl?: string;
  read: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// ──────────────────────────────────────────────
// Chat operations
// ──────────────────────────────────────────────

/**
 * Create a new chat between two users for a delivery.
 * יצירת צ׳אט חדש בין שני משתמשים עבור משלוח
 */
export async function createChat(
  senderId: string,
  driverId: string,
  deliveryId: string,
): Promise<string> {
  const chatData: Omit<ChatDoc, 'lastMessageAt' | 'createdAt'> & {
    lastMessageAt: FirebaseFirestoreTypes.FieldValue;
    createdAt: FirebaseFirestoreTypes.FieldValue;
  } = {
    participants: [senderId, driverId],
    deliveryId,
    lastMessage: '',
    lastMessageAt: firestore.FieldValue.serverTimestamp(),
    lastSenderId: '',
    createdAt: firestore.FieldValue.serverTimestamp(),
  };

  const ref = await firestore().collection('chats').add(chatData);
  return ref.id;
}

/**
 * Send a text message.
 * שליחת הודעת טקסט
 */
export async function sendTextMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<string> {
  const messageData = {
    chatId,
    senderId,
    text,
    type: 'text',
    read: false,
    createdAt: firestore.FieldValue.serverTimestamp(),
  };

  const ref = await firestore()
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .add(messageData);

  // Update chat metadata
  await firestore().collection('chats').doc(chatId).update({
    lastMessage: text,
    lastMessageAt: firestore.FieldValue.serverTimestamp(),
    lastSenderId: senderId,
  });

  return ref.id;
}

/**
 * Send an image message.
 * שליחת הודעת תמונה
 */
export async function sendImageMessage(
  chatId: string,
  senderId: string,
  imageUrl: string,
): Promise<string> {
  const messageData = {
    chatId,
    senderId,
    text: '',
    type: 'image',
    imageUrl,
    read: false,
    createdAt: firestore.FieldValue.serverTimestamp(),
  };

  const ref = await firestore()
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .add(messageData);

  await firestore().collection('chats').doc(chatId).update({
    lastMessage: '[Image]',
    lastMessageAt: firestore.FieldValue.serverTimestamp(),
    lastSenderId: senderId,
  });

  return ref.id;
}

/**
 * Get all chats for a user.
 * שליפת כל הצ׳אטים של משתמש
 */
export async function getUserChats(userId: string): Promise<{ id: string; data: ChatDoc }[]> {
  const snapshot = await firestore()
    .collection('chats')
    .where('participants', 'array-contains', userId)
    .orderBy('lastMessageAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as ChatDoc }));
}

/**
 * Get unread message count for a chat.
 * ספירת הודעות שלא נקראו בצ׳אט
 */
export async function getUnreadCount(chatId: string, userId: string): Promise<number> {
  const snapshot = await firestore()
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .where('read', '==', false)
    .where('senderId', '!=', userId)
    .get();

  return snapshot.size;
}
