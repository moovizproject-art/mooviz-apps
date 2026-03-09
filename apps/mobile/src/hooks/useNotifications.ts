/**
 * useNotifications — הוק התראות
 * FCM token registration, foreground notification display, and tap handlers.
 * Uses @react-native-firebase/messaging + @notifee for bare RN compatibility.
 *
 * Smart chat notification behavior:
 * - If user is viewing the SAME chat → only play "ding" sound, no notification banner
 * - If user is in a DIFFERENT chat or not in chat → show full notification, tap navigates to chat
 * - Background/quit tap → deep-link to the correct chat thread
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidAction, EventType } from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';

import { useAuth } from './useAuth';
import { playSound } from '../services/sound';
import { navigateFromNotification, getActiveChatId } from '../services/navigation';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface UseNotificationsResult {
  fcmToken: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

/** Create Android notification channels (required for Android 8+) */
async function ensureAndroidChannels(): Promise<string> {
  // Main channel — must match backend channelId in notificationService.ts
  await notifee.createChannel({
    id: 'mooviz_deliveries',
    name: 'משלוחים והתראות',
    description: 'התראות על משלוחים, צ׳אט ותשלומים',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  // Chat channel
  await notifee.createChannel({
    id: 'mooviz_chat',
    name: 'הודעות צ׳אט',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  return 'mooviz_deliveries';
}

/** Set up iOS notification categories with action buttons */
async function setupNotificationCategories(): Promise<void> {
  await notifee.setNotificationCategories([
    {
      id: 'chat',
      actions: [{ id: 'reply', title: 'פתח צ׳אט' }],
    },
    {
      id: 'delivery',
      actions: [{ id: 'view', title: 'צפה במשלוח' }],
    },
    {
      id: 'tracking',
      actions: [{ id: 'track', title: 'מעקב' }],
    },
  ]);
}

/** Get Android actions and iOS categoryId based on notification event */
function getNotificationActions(notifEvent?: string): {
  androidActions?: AndroidAction[];
  iosCategoryId?: string;
} {
  switch (notifEvent) {
    case 'new_chat_message':
      return {
        androidActions: [{ title: 'פתח צ׳אט', pressAction: { id: 'open_chat' } }],
        iosCategoryId: 'chat',
      };
    case 'driver_interested':
    case 'sender_approved':
      return {
        androidActions: [{ title: 'צפה במשלוח', pressAction: { id: 'view_delivery' } }],
        iosCategoryId: 'delivery',
      };
    case 'delivery_picked_up':
    case 'delivery_delivered':
      return {
        androidActions: [{ title: 'מעקב', pressAction: { id: 'track' } }],
        iosCategoryId: 'tracking',
      };
    default:
      return {};
  }
}

export function useNotifications(): UseNotificationsResult {
  const { currentUser } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  /** Request notification permissions — Android 13+ needs explicit runtime permission */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Android 13+ (API 33) requires POST_NOTIFICATIONS runtime permission
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(false);
          return false;
        }
      }

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      setHasPermission(enabled);
      return enabled;
    } catch (error) {
      console.error('[useNotifications] Permission error:', error);
      return false;
    }
  }, []);

  // Create notification channels (Android) and categories (iOS) on mount
  useEffect(() => {
    if (Platform.OS === 'android') {
      ensureAndroidChannels().catch(() => {});
    }
    setupNotificationCategories().catch(() => {});
  }, []);

  // Register FCM token and save to Firestore
  useEffect(() => {
    const registerToken = async (): Promise<void> => {
      try {
        const granted = await requestPermission();
        if (!granted) {
          console.warn('[useNotifications] Permission not granted');
          return;
        }

        // Must register for remote messages before getting token
        if (!messaging().isDeviceRegisteredForRemoteMessages) {
          await messaging().registerDeviceForRemoteMessages();
        }

        const token = await messaging().getToken();
        console.log('[useNotifications] FCM token:', token?.substring(0, 20) + '...');
        setFcmToken(token);

        if (currentUser?.uid && token) {
          await firestore().collection('users').doc(currentUser.uid).update({
            fcmTokens: firestore.FieldValue.arrayUnion(token),
            lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
          });
          console.log('[useNotifications] Token saved to Firestore');
        }
      } catch (error) {
        // Expected on iOS Simulator (no APNs support)
        if (Platform.OS === 'ios') {
          console.log('[useNotifications] iOS Simulator — FCM not available (no APNs)');
        } else {
          console.warn('[useNotifications] Token registration failed:', (error as any)?.message || error);
        }
      }
    };

    registerToken();

    // Listen for token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
      setFcmToken(newToken);
      if (currentUser?.uid) {
        await firestore().collection('users').doc(currentUser.uid).update({
          fcmTokens: firestore.FieldValue.arrayUnion(newToken),
        });
      }
    });

    return () => unsubscribeTokenRefresh();
  }, [currentUser?.uid, requestPermission]);

  // Handle foreground notifications via notifee
  useEffect(() => {
    const unsubscribeForeground = messaging().onMessage(
      async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('[Notifications] Foreground message:', remoteMessage);

        if (!remoteMessage.notification) return;

        const data = remoteMessage.data as Record<string, string> | undefined;
        const notifEvent = data?.event;
        const incomingChatId = data?.chatId;
        const activeChatId = getActiveChatId();

        // Smart chat notification: if user is viewing the same chat, only play ding
        if (notifEvent === 'new_chat_message' && incomingChatId && incomingChatId === activeChatId) {
          console.log('[Notifications] Same chat active — ding only, no banner');
          playSound('success');
          return;
        }

        // Play sound based on notification type
        if (notifEvent === 'new_listing_nearby') playSound('new_delivery');
        else if (notifEvent === 'driver_interested') playSound('driver_interested');
        else if (notifEvent === 'payment_confirmed') playSound('payment');
        else playSound('success');

        const channelId = await ensureAndroidChannels();
        const isChatNotif = notifEvent === 'new_chat_message';
        const { androidActions, iosCategoryId } = getNotificationActions(notifEvent);

        await notifee.displayNotification({
          title: remoteMessage.notification.title || 'MOOVIZ',
          body: remoteMessage.notification.body || '',
          data: data as Record<string, string>,
          android: {
            channelId: isChatNotif ? 'mooviz_chat' : channelId,
            smallIcon: 'ic_launcher',
            pressAction: { id: 'default' },
            importance: AndroidImportance.HIGH,
            ...(androidActions && { actions: androidActions }),
          },
          ...(iosCategoryId && { ios: { categoryId: iosCategoryId } }),
        });
      },
    );

    // Notifee foreground event — handle notification tap while app is open
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if ((type === EventType.PRESS || type === EventType.ACTION_PRESS) && detail.notification?.data) {
        handleNotificationNavigation(detail.notification.data as Record<string, string>);
      }
    });

    // Background/quit notification tap handler (FCM)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[Notifications] Opened from background:', remoteMessage);
      handleNotificationNavigation(remoteMessage.data as Record<string, string> | undefined);
    });

    // Check if app was opened by notification from quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[Notifications] Opened from quit state:', remoteMessage);
          handleNotificationNavigation(remoteMessage.data as Record<string, string> | undefined);
        }
      });

    return () => {
      unsubscribeForeground();
      unsubscribeNotifee();
    };
  }, []);

  return { fcmToken, hasPermission, requestPermission };
}

/**
 * Handle navigation from notification tap.
 * Uses the navigation service to deep-link to the correct screen.
 */
function handleNotificationNavigation(data?: Record<string, string>): void {
  if (!data) return;

  const { event, deliveryId, chatId, senderName } = data;

  switch (event) {
    case 'new_chat_message':
      if (chatId) {
        console.log('[Nav] Navigate to chat:', chatId);
        navigateFromNotification('ChatRoom', {
          chatId,
          recipientName: senderName || '',
        });
      }
      break;
    case 'driver_interested':
    case 'sender_approved':
    case 'delivery_picked_up':
    case 'delivery_delivered':
    case 'delivery_cancelled':
      if (deliveryId) {
        console.log('[Nav] Navigate to delivery:', deliveryId);
        // Try sender detail first, driver detail if that fails
        navigateFromNotification('SenderDeliveryDetail', { deliveryId });
      }
      break;
    case 'payment_confirmed':
      if (deliveryId) {
        navigateFromNotification('SenderDeliveryDetail', { deliveryId });
      }
      break;
    default:
      console.log('[Nav] Unknown notification event:', event);
  }
}
