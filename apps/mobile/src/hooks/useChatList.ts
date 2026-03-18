import { useState, useEffect, useRef } from 'react';
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
  itemDescription: string;
  pickupDate: string;
  /** Unread count (messages sent by others since user last read) */
  unreadCount: number;
}

/**
 * useChatList — רשימת צ׳אטים
 * Real-time listener for the current user's chat threads.
 * Uses cached user/delivery data to avoid N+1 queries on every update.
 * Falls back to denormalized fields on the chat doc when available.
 */
export function useChatList(userId: string | undefined) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist caches across listener firings to avoid re-fetching known users/deliveries
  const userCache = useRef(new Map<string, { name: string; photo: string | null }>());
  const deliveryCache = useRef(new Map<string, { status: string; pickupCity: string; destCity: string; itemDesc: string; pickupDate: string }>());

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

          // Collect UIDs and delivery IDs NOT already in cache
          const missingUids: string[] = [];
          const missingDeliveryIds: string[] = [];
          docs.forEach((doc) => {
            const data = doc.data();
            (data.participants as string[]).forEach((p) => {
              if (p !== userId && !userCache.current.has(p)) missingUids.push(p);
            });
            if (data.deliveryId && !deliveryCache.current.has(data.deliveryId)) {
              missingDeliveryIds.push(data.deliveryId);
            }
          });

          // Fetch only missing users
          if (missingUids.length > 0) {
            await Promise.all(
              missingUids.map((uid) =>
                firestore().collection('users').doc(uid).get()
                  .then((uDoc) => {
                    if (uDoc.exists) {
                      const d = uDoc.data()!;
                      userCache.current.set(uid, {
                        name: d.fullName || '',
                        photo: d.profilePhotoURL || null,
                      });
                    }
                  })
                  .catch(() => {}),
              ),
            );
          }

          // Fetch only missing deliveries
          if (missingDeliveryIds.length > 0) {
            await Promise.all(
              missingDeliveryIds.map((dId) =>
                firestore().collection('deliveries').doc(dId).get()
                  .then((dDoc) => {
                    if (dDoc.exists) {
                      const d = dDoc.data()!;
                      let dateStr = 'ASAP';
                      if (d.pickupDate && d.pickupDate !== 'asap') {
                        const date = d.pickupDate?.toDate ? d.pickupDate.toDate() : new Date(d.pickupDate);
                        dateStr = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
                      }
                      deliveryCache.current.set(dId, {
                        status: d.status || 'new',
                        pickupCity: d.pickup?.city || d.pickup?.address || '',
                        destCity: d.destination?.city || d.destination?.address || '',
                        itemDesc: d.itemDescription || d.item?.description || '',
                        pickupDate: dateStr,
                      });
                    }
                  })
                  .catch(() => {}),
              ),
            );
          }

          const chatThreads: ChatThread[] = docs.map((doc) => {
            const data = doc.data();
            const recipientId = (data.participants as string[]).find((p) => p !== userId) || '';
            const user = userCache.current.get(recipientId);
            const delivery = deliveryCache.current.get(data.deliveryId || '');

            // Use denormalized fields on chat doc as fallback
            const recipientName = user?.name || data.senderName || data.driverName || recipientId.slice(0, 8);
            const recipientPhoto = user?.photo || null;

            return {
              id: doc.id,
              deliveryId: data.deliveryId || '',
              participants: data.participants || [],
              lastMessage: data.lastMessage || '',
              lastMessageAt: data.lastMessageAt?.toDate() || new Date(),
              lastSenderId: data.lastSenderId || '',
              recipientId,
              recipientName,
              recipientPhotoUrl: recipientPhoto,
              pickupCity: delivery?.pickupCity || '',
              destinationCity: delivery?.destCity || '',
              deliveryStatus: delivery?.status || '',
              itemDescription: delivery?.itemDesc || '',
              pickupDate: delivery?.pickupDate || '',
              unreadCount: (() => {
                if (data.lastSenderId === userId || data.lastSenderId === 'system' || !data.lastMessage) return 0;
                if (data.closed) return 0;
                const lastReadAt = data.lastReadBy?.[userId]?.toDate?.()?.getTime() ?? 0;
                const lastMsgAt = data.lastMessageAt?.toDate?.()?.getTime() ?? 0;
                return lastMsgAt > lastReadAt ? 1 : 0;
              })()
            };
          });

          chatThreads.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
          setThreads(chatThreads);
          setIsLoading(false);
        },
        (err) => {
          console.error('[useChatList] Listener error:', err);
          const code = (err as any)?.code;
          if (code === 'permission-denied') {
            setError('permission-denied');
          } else {
            setError('load-failed');
          }
          setIsLoading(false);
        },
      );

    return unsubscribe;
  }, [userId]);

  return { threads, isLoading, error };
}
