import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';

export interface ChatThread {
  id: string;
  deliveryId: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Date;
  lastSenderId: string;
  recipientId: string;
  recipientName: string;
}

/**
 * useChatList — רשימת צ׳אטים
 * Real-time listener for the current user's chat threads.
 */
export function useChatList(userId: string | undefined) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      console.log('[useChatList] No userId, skipping');
      setThreads([]);
      setIsLoading(false);
      return;
    }

    console.log('[useChatList] Setting up listener for', userId);

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .onSnapshot(
        (snapshot) => {
          console.log('[useChatList] Snapshot received, docs:', snapshot.docs.length);
          const docs = snapshot.docs;
          if (docs.length === 0) {
            setThreads([]);
            setIsLoading(false);
            return;
          }

          // Collect unique other-participant UIDs
          const otherUids = new Set<string>();
          docs.forEach((doc) => {
            const data = doc.data();
            (data.participants as string[]).forEach((p) => {
              if (p !== userId) otherUids.add(p);
            });
          });

          // Fetch user names by document ID (more reliable than querying uid field)
          const uidArray = Array.from(otherUids);
          const nameMap = new Map<string, string>();

          Promise.all(
            uidArray.map((uid) =>
              firestore()
                .collection('users')
                .doc(uid)
                .get()
                .then((uDoc) => {
                  if (uDoc.exists) {
                    nameMap.set(uid, uDoc.data()?.fullName || '');
                  }
                })
                .catch((err) => {
                  console.warn('[useChatList] Failed to fetch user', uid, err.message);
                })
            )
          ).then(() => {
            const chatThreads: ChatThread[] = docs.map((doc) => {
              const data = doc.data();
              const recipientId = (data.participants as string[]).find((p) => p !== userId) || '';
              return {
                id: doc.id,
                deliveryId: data.deliveryId || '',
                participants: data.participants || [],
                lastMessage: data.lastMessage || '',
                lastMessageAt: data.lastMessageAt?.toDate() || new Date(),
                lastSenderId: data.lastSenderId || '',
                recipientId,
                recipientName: nameMap.get(recipientId) || recipientId.slice(0, 8),
              };
            });

            // Sort by lastMessageAt descending (client-side to avoid composite index)
            chatThreads.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
            console.log('[useChatList] Setting', chatThreads.length, 'threads');
            setThreads(chatThreads);
            setIsLoading(false);
          }).catch((err) => {
            console.error('[useChatList] Name fetch error:', err);
            setIsLoading(false);
          });
        },
        (error) => {
          console.error('[useChatList] Listener error:', error);
          setIsLoading(false);
        },
      );

    return unsubscribe;
  }, [userId]);

  return { threads, isLoading };
}
