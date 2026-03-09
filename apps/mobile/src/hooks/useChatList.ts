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
  recipientPhotoUrl: string | null;
  /** Delivery context */
  pickupCity: string;
  destinationCity: string;
  deliveryStatus: string;
  /** Unread count (messages sent by others since user last read) */
  unreadCount: number;
}

/**
 * useChatList — רשימת צ׳אטים
 * Real-time listener for the current user's chat threads.
 * Enriches each thread with recipient photo and delivery context.
 */
export function useChatList(userId: string | undefined) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setThreads([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .onSnapshot(
        async (snapshot) => {
          const docs = snapshot.docs;
          if (docs.length === 0) {
            setThreads([]);
            setIsLoading(false);
            return;
          }

          // Collect unique other-participant UIDs and delivery IDs
          const otherUids = new Set<string>();
          const deliveryIds = new Set<string>();
          docs.forEach((doc) => {
            const data = doc.data();
            (data.participants as string[]).forEach((p) => {
              if (p !== userId) otherUids.add(p);
            });
            if (data.deliveryId) deliveryIds.add(data.deliveryId);
          });

          // Fetch user profiles (name + photo)
          const userMap = new Map<string, { name: string; photo: string | null }>();
          await Promise.all(
            Array.from(otherUids).map((uid) =>
              firestore().collection('users').doc(uid).get()
                .then((uDoc) => {
                  if (uDoc.exists) {
                    const d = uDoc.data()!;
                    userMap.set(uid, {
                      name: d.fullName || '',
                      photo: d.profilePhotoURL || null,
                    });
                  }
                })
                .catch(() => {}),
            ),
          );

          // Fetch delivery info (status + cities)
          const deliveryMap = new Map<string, { status: string; pickupCity: string; destCity: string }>();
          await Promise.all(
            Array.from(deliveryIds).map((dId) =>
              firestore().collection('deliveries').doc(dId).get()
                .then((dDoc) => {
                  if (dDoc.exists) {
                    const d = dDoc.data()!;
                    deliveryMap.set(dId, {
                      status: d.status || 'pending',
                      pickupCity: d.pickup?.city || d.pickup?.address || '',
                      destCity: d.destination?.city || d.destination?.address || '',
                    });
                  }
                })
                .catch(() => {}),
            ),
          );

          const chatThreads: ChatThread[] = docs.map((doc) => {
            const data = doc.data();
            const recipientId = (data.participants as string[]).find((p) => p !== userId) || '';
            const user = userMap.get(recipientId);
            const delivery = deliveryMap.get(data.deliveryId || '');

            return {
              id: doc.id,
              deliveryId: data.deliveryId || '',
              participants: data.participants || [],
              lastMessage: data.lastMessage || '',
              lastMessageAt: data.lastMessageAt?.toDate() || new Date(),
              lastSenderId: data.lastSenderId || '',
              recipientId,
              recipientName: user?.name || recipientId.slice(0, 8),
              recipientPhotoUrl: user?.photo || null,
              pickupCity: delivery?.pickupCity || '',
              destinationCity: delivery?.destCity || '',
              deliveryStatus: delivery?.status || '',
              unreadCount: 0, // TODO: compute from unread messages
            };
          });

          chatThreads.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
          setThreads(chatThreads);
          setIsLoading(false);
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
