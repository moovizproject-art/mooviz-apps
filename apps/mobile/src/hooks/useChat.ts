import { useState, useEffect, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';

import { uploadImage } from '../services/storage';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'system';
  imageUrl?: string;
  createdAt: Date;
  read: boolean;
}

interface SendMessageInput {
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image';
}

interface SendImageInput {
  chatId: string;
  senderId: string;
  imageUri: string;
}

interface UseChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isClosed: boolean;
  sendMessage: (input: SendMessageInput) => Promise<void>;
  sendImage: (input: SendImageInput) => Promise<void>;
  markAsRead: (messageIds: string[]) => Promise<void>;
}

/**
 * useChat — הוק צ׳אט
 * Chat message real-time listener and send function.
 * האזנה בזמן אמת להודעות צ׳אט ופונקציית שליחה
 */
export function useChat(chatId: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isClosed, setIsClosed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Listen to chat document for closed status
  useEffect(() => {
    if (!chatId) return;
    const unsub = firestore()
      .collection('chats')
      .doc(chatId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          setIsClosed(doc.data()?.closed === true);
        }
      });
    return unsub;
  }, [chatId]);

  // Real-time listener for chat messages
  // מאזין בזמן אמת להודעות צ׳אט
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .onSnapshot(
        (snapshot) => {
          const msgs: ChatMessage[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              chatId: data.chatId,
              senderId: data.senderId,
              text: data.text || '',
              type: data.type || 'text',
              imageUrl: data.imageUrl,
              createdAt: data.createdAt?.toDate() || new Date(),
              read: data.read || false,
            };
          });
          setMessages(msgs);
          setIsLoading(false);
        },
        (error) => {
          console.warn('[useChat] Listener error:', error.message || error);
          setMessages([]);
          setIsLoading(false);
        },
      );

    return unsubscribe;
  }, [chatId]);

  const sendMessage = useCallback(
    async (input: SendMessageInput): Promise<void> => {
      if (!input.chatId) return;

      const batch = firestore().batch();

      // Create a new doc ref with auto-generated ID for the message
      const messageRef = firestore()
        .collection('chats')
        .doc(input.chatId)
        .collection('messages')
        .doc();

      batch.set(messageRef, {
        chatId: input.chatId,
        senderId: input.senderId,
        text: input.text,
        type: input.type,
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Update chat metadata with last message + mark sender as read
      // עדכון מטאדאטה של הצ׳אט עם ההודעה האחרונה
      const chatRef = firestore().collection('chats').doc(input.chatId);
      batch.update(chatRef, {
        lastMessage: input.text,
        lastMessageAt: firestore.FieldValue.serverTimestamp(),
        lastSenderId: input.senderId,
        [`lastReadBy.${input.senderId}`]: firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();
    },
    [],
  );

  const sendImage = useCallback(
    async (input: SendImageInput): Promise<void> => {
      if (!input.chatId) return;

      // Upload image to Cloud Storage
      const imageUrl = await uploadImage(
        input.imageUri,
        `chats/${input.chatId}/${Date.now()}.jpg`,
      );

      const batch = firestore().batch();

      // Create a new doc ref with auto-generated ID for the image message
      const messageRef = firestore()
        .collection('chats')
        .doc(input.chatId)
        .collection('messages')
        .doc();

      batch.set(messageRef, {
        chatId: input.chatId,
        senderId: input.senderId,
        text: '',
        type: 'image',
        imageUrl,
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      const chatRef = firestore().collection('chats').doc(input.chatId);
      batch.update(chatRef, {
        lastMessage: '[תמונה]', // [Image]
        lastMessageAt: firestore.FieldValue.serverTimestamp(),
        lastSenderId: input.senderId,
        [`lastReadBy.${input.senderId}`]: firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();
    },
    [],
  );

  const markAsRead = useCallback(
    async (messageIds: string[]): Promise<void> => {
      if (!chatId || messageIds.length === 0) return;

      const batch = firestore().batch();
      messageIds.forEach((msgId) => {
        const ref = firestore()
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .doc(msgId);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    },
    [chatId],
  );

  return { messages, isLoading, isClosed, sendMessage, sendImage, markAsRead };
}
