/**
 * useNotifications — הוק התראות
 * FCM token registration, foreground notification display, and tap handlers.
 * Uses @react-native-firebase/messaging + @notifee for bare RN compatibility.
 *
 * Smart chat notification behavior:
 * - If user is viewing the SAME chat → only play "ding" sound, no notification banner
 * - If user is in a DIFFERENT chat or not in chat → show full notification, tap navigates to chat
 * - Background/quit tap → deep-link to the correct chat thread
 *
 * Enhanced driver_interested notifications:
 * - Includes driver photo as largeIcon (Android) / attachment (iOS)
 * - Approve/Decline action buttons on notification
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, AppState } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidAction, EventType } from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './useAuth';
import { playSound } from '../services/sound';
import { navigateFromNotification, getActiveChatId } from '../services/navigation';
import { strings } from '../i18n/strings';

const PREFS_KEY = '@driver_preferences';

/** Check if current time falls within any quiet hour range */
async function isInQuietHours(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return false;
    const prefs = JSON.parse(raw);
    const quietHours: Array<{ from: string; to: string }> = prefs.quietHours || [];
    if (quietHours.length === 0) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const qh of quietHours) {
      const [fh, fm] = (qh.from || '22:00').split(':').map(Number);
      const [th, tm] = (qh.to || '08:00').split(':').map(Number);
      const fromMin = (fh || 0) * 60 + (fm || 0);
      const toMin = (th || 0) * 60 + (tm || 0);

      if (fromMin <= toMin) {
        // Same day range (e.g., 14:00-18:00)
        if (currentMinutes >= fromMin && currentMinutes < toMin) return true;
      } else {
        // Overnight range (e.g., 22:00-08:00)
        if (currentMinutes >= fromMin || currentMinutes < toMin) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface UseNotificationsResult {
  fcmToken: string | null;
  hasPermission: boolean;
  notificationError: string | null;
  requestPermission: () => Promise<boolean>;
}

/** Per-event Android channel IDs. Must match what notificationService.ts sends as channelId. */
export const ANDROID_CHANNEL_IDS: Record<string, string> = {
  new_listing_nearby: 'mooviz_new_delivery_v3',
  driver_interested:  'mooviz_driver_interested_v3',
  payment_confirmed:  'mooviz_payment_v3',
  delivery_cancelled: 'mooviz_error_v3',
  new_chat_message:   'mooviz_chat',
  default:            'mooviz_success_v3',
};

/** Create all Android notification channels (idempotent — safe to call on every launch) */
async function ensureAndroidChannels(): Promise<void> {
  await Promise.all([
    notifee.createChannel({
      id: 'mooviz_new_delivery_v3',
      name: 'משלוחים חדשים',
      importance: AndroidImportance.HIGH,
      sound: 'new_delivery',
      vibration: true,
    }),
    notifee.createChannel({
      id: 'mooviz_driver_interested_v3',
      name: 'נהגים מעוניינים',
      importance: AndroidImportance.HIGH,
      sound: 'driver_interested',
      vibration: true,
    }),
    notifee.createChannel({
      id: 'mooviz_payment_v3',
      name: 'תשלומים',
      importance: AndroidImportance.HIGH,
      sound: 'payment',
      vibration: true,
    }),
    notifee.createChannel({
      id: 'mooviz_error_v3',
      name: 'ביטולים ושגיאות',
      importance: AndroidImportance.HIGH,
      sound: 'error',
      vibration: true,
    }),
    notifee.createChannel({
      id: 'mooviz_success_v3',
      name: strings.notifications.deliveriesAndAlerts.he,
      description: strings.notifications.deliveriesAndAlertsDesc.he,
      importance: AndroidImportance.HIGH,
      sound: 'success',
      vibration: true,
    }),
    notifee.createChannel({
      id: 'mooviz_chat',
      name: strings.notifications.chatMessages.he,
      importance: AndroidImportance.HIGH,
      sound: 'question',
    }),
    // Keep legacy channel so old messages still display correctly
    notifee.createChannel({
      id: 'mooviz_deliveries_v2',
      name: 'עדכוני משלוח (ישן)',
      importance: AndroidImportance.HIGH,
      sound: 'new_delivery',
    }),
  ]);
}

/** Set up iOS notification categories with action buttons */
async function setupNotificationCategories(): Promise<void> {
  await notifee.setNotificationCategories([
    {
      id: 'chat',
      actions: [{ id: 'reply', title: strings.notifications.openChat.he }],
    },
    {
      id: 'delivery',
      actions: [{ id: 'view', title: strings.notifications.viewDelivery.he }],
    },
    {
      id: 'tracking',
      actions: [{ id: 'track', title: strings.notifications.tracking.he }],
    },
    {
      id: 'driver_approval',
      actions: [
        { id: 'approve_driver', title: '✓ ' + strings.notifications.approve.he, foreground: true },
        { id: 'decline_driver', title: '✗ ' + strings.notifications.decline.he, destructive: true },
      ],
    },
    {
      id: 'delivery_interest',
      actions: [
        { id: 'accept_delivery', title: '✓ ' + strings.notifications.acceptDelivery.he, foreground: true },
        { id: 'skip_delivery', title: '✗ ' + strings.notifications.skipDelivery.he, destructive: true },
      ],
    },
    {
      id: 'sender_approved_confirm',
      actions: [
        { id: 'confirm_pickup', title: '✓ כן, בדרך!', foreground: true },
        { id: 'cancel_delivery', title: '✗ לא יכול', destructive: true },
      ],
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
        androidActions: [{ title: strings.notifications.openChat.he, pressAction: { id: 'open_chat' } }],
        iosCategoryId: 'chat',
      };
    case 'new_listing_nearby':
      return {
        androidActions: [
          { title: '✓ ' + strings.notifications.acceptDelivery.he, pressAction: { id: 'accept_delivery' } },
          { title: '✗ ' + strings.notifications.skipDelivery.he, pressAction: { id: 'skip_delivery' } },
        ],
        iosCategoryId: 'delivery_interest',
      };
    case 'driver_interested':
      return {
        androidActions: [
          { title: '✓ ' + strings.notifications.approve.he, pressAction: { id: 'approve_driver' } },
          { title: '✗ ' + strings.notifications.decline.he, pressAction: { id: 'decline_driver' } },
        ],
        iosCategoryId: 'driver_approval',
      };
    case 'sender_approved':
      return {
        androidActions: [
          { title: '✓ כן, בדרך!', pressAction: { id: 'confirm_pickup' } },
          { title: '✗ לא יכול', pressAction: { id: 'cancel_delivery' } },
        ],
        iosCategoryId: 'sender_approved_confirm',
      };
    case 'delivery_picked_up':
    case 'delivery_delivered':
      return {
        androidActions: [{ title: strings.notifications.tracking.he, pressAction: { id: 'track' } }],
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
  const [notificationError, setNotificationError] = useState<string | null>(null);

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

    // Reset iOS badge count when app opens and whenever it comes to foreground
    notifee.setBadgeCount(0).catch(() => {});
    const badgeSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') notifee.setBadgeCount(0).catch(() => {});
    });
    return () => badgeSub.remove();
  }, []);

  // Step 1: Request permission + get token ON MOUNT (no dependency on currentUser)
  useEffect(() => {
    const getTokenEarly = async (): Promise<void> => {
      try {
        const granted = await requestPermission();
        if (!granted) {
          console.warn('[useNotifications] Permission not granted');
          return;
        }

        if (!messaging().isDeviceRegisteredForRemoteMessages) {
          await messaging().registerDeviceForRemoteMessages();
        }

        const token = await messaging().getToken();
        console.log('[useNotifications] FCM token:', token?.substring(0, 20) + '...');
        setFcmToken(token);
      } catch (error) {
        if (Platform.OS === 'ios') {
          console.log('[useNotifications] iOS Simulator — FCM not available (no APNs)');
        } else {
          console.warn('[useNotifications] Token registration failed:', (error as any)?.message || error);
          setNotificationError('token-registration-failed');
        }
      }
    };

    getTokenEarly();
  }, [requestPermission]);

  // Step 2: Save token to Firestore WHEN currentUser becomes available
  useEffect(() => {
    if (!currentUser?.uid || !fcmToken) return;

    // Replace token list on every app start — ensures fresh token, clears stale ones
    firestore().collection('users').doc(currentUser.uid).update({
      fcmTokens: [fcmToken],
      lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
    }).then(() => {
      console.log('[useNotifications] Token saved to Firestore');
    }).catch((err) => {
      console.warn('[useNotifications] Failed to save token:', err);
    });

    // Listen for token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
      setFcmToken(newToken);
      if (currentUser?.uid) {
        await firestore().collection('users').doc(currentUser.uid).update({
          fcmTokens: [newToken],
          lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    return () => unsubscribeTokenRefresh();
  }, [currentUser?.uid, fcmToken]);

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

        // Smart chat notification: if user is viewing the same chat, suppress entirely
        // (they already see messages appear in real-time via onSnapshot)
        if (notifEvent === 'new_chat_message' && incomingChatId && incomingChatId === activeChatId) {
          console.log('[Notifications] Same chat active — suppressed');
          return;
        }

        // Check quiet hours — silence notifications during quiet time
        const quietMode = await isInQuietHours();

        // Play sound based on notification type (skip if quiet hours)
        if (!quietMode) {
          if (notifEvent === 'new_listing_nearby') playSound('new_delivery');
          else if (notifEvent === 'driver_interested') playSound('driver_interested');
          else if (notifEvent === 'payment_confirmed') playSound('payment');
        }

        await ensureAndroidChannels();
        const eventChannelId = ANDROID_CHANNEL_IDS[notifEvent ?? ''] ?? ANDROID_CHANNEL_IDS.default;
        const { androidActions, iosCategoryId } = getNotificationActions(notifEvent);

        // Build notification config
        const notificationConfig: any = {
          title: remoteMessage.notification.title || 'MOOVIZ',
          body: remoteMessage.notification.body || '',
          data: data as Record<string, string>,
          android: {
            channelId: eventChannelId,
            smallIcon: 'ic_launcher',
            pressAction: { id: 'default' },
            importance: quietMode ? AndroidImportance.LOW : AndroidImportance.HIGH,
            ...(quietMode && { sound: undefined }),
            ...(androidActions && { actions: androidActions }),
          },
          ...(iosCategoryId && { ios: { categoryId: iosCategoryId } }),
          ...(quietMode && { ios: { sound: undefined, ...(iosCategoryId && { categoryId: iosCategoryId }) } }),
        };

        // Add driver photo as largeIcon for driver_interested
        if (notifEvent === 'driver_interested' && data?.driverPhoto) {
          notificationConfig.android.largeIcon = data.driverPhoto;
          if (!notificationConfig.ios) notificationConfig.ios = {};
          notificationConfig.ios.attachments = [
            { url: data.driverPhoto, thumbnailHidden: false },
          ];
        }

        await notifee.displayNotification(notificationConfig);
      },
    );

    // Notifee foreground event — handle notification tap and action buttons
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && detail.notification?.data) {
        const data = detail.notification.data as Record<string, string>;
        const actionId = detail.pressAction?.id;
        handleNotificationAction(actionId, data);
      } else if (type === EventType.PRESS && detail.notification?.data) {
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

  return { fcmToken, hasPermission, notificationError, requestPermission };
}

/**
 * Handle notification action button press (approve/decline driver).
 */
async function handleNotificationAction(actionId: string | undefined, data: Record<string, string>): Promise<void> {
  if (!actionId) return;

  const { deliveryId } = data;
  if (!deliveryId) return;

  switch (actionId) {
    case 'accept_delivery': {
      console.log('[NotifAction] Expressing interest in delivery:', deliveryId);
      try {
        const fn = functions().httpsCallable('expressInterest');
        await fn({ deliveryId });
        navigateFromNotification('DriverDeliveryDetail', { deliveryId });
      } catch (err: any) {
        console.error('[NotifAction] Accept delivery failed:', err.message);
      }
      break;
    }
    case 'skip_delivery': {
      // Just dismiss — no action needed
      break;
    }
    case 'approve_driver': {
      console.log('[NotifAction] Approving driver for delivery:', deliveryId);
      try {
        const fn = functions().httpsCallable('approveDriver');
        await fn({ deliveryId });
        // Navigate to delivery detail to see updated status
        navigateFromNotification('SenderDeliveryDetail', { deliveryId });
      } catch (err: any) {
        console.error('[NotifAction] Approve failed:', err.message);
      }
      break;
    }
    case 'decline_driver': {
      console.log('[NotifAction] Declining driver for delivery:', deliveryId);
      try {
        const fn = functions().httpsCallable('declineDriver');
        await fn({ deliveryId });
      } catch (err: any) {
        console.error('[NotifAction] Decline failed:', err.message);
      }
      break;
    }
    case 'confirm_pickup': {
      // Driver tapped "כן, בדרך!" on sender_approved notification → navigate to delivery
      console.log('[NotifAction] Driver confirmed on way to pickup:', deliveryId);
      navigateFromNotification('DriverDeliveryDetail', { deliveryId });
      break;
    }
    case 'cancel_delivery': {
      // Driver tapped "לא יכול" on sender_approved notification → cancel the delivery
      console.log('[NotifAction] Driver cancelling delivery from notification:', deliveryId);
      try {
        const fn = functions().httpsCallable('cancelDelivery');
        await fn({ deliveryId });
      } catch (err: any) {
        console.error('[NotifAction] Cancel delivery failed:', err.message);
      }
      break;
    }
    default:
      // For other actions, just navigate
      handleNotificationNavigation(data);
  }
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
      if (deliveryId) {
        console.log('[Nav] Navigate to sender delivery detail for approval:', deliveryId);
        navigateFromNotification('SenderDeliveryDetail', { deliveryId });
      }
      break;
    case 'driver_selected':
      if (deliveryId) {
        console.log('[Nav] Navigate to driver delivery detail for confirmation:', deliveryId);
        navigateFromNotification('DriverDeliveryDetail', { deliveryId });
      }
      break;
    case 'sender_approved':
      // Driver gets notified that sender approved them
      if (deliveryId) {
        console.log('[Nav] Navigate to driver delivery (sender approved):', deliveryId);
        navigateFromNotification('DriverDeliveryDetail', { deliveryId });
      }
      break;
    case 'delivery_picked_up':
    case 'delivery_delivered':
    case 'delivery_cancelled':
    case 'payment_confirmed':
      if (deliveryId) {
        console.log('[Nav] Navigate to delivery:', deliveryId);
        // Route to correct screen based on user role
        const role = data.recipientRole;
        const screen = role === 'driver' ? 'DriverDeliveryDetail' : 'SenderDeliveryDetail';
        navigateFromNotification(screen, { deliveryId });
      }
      break;
    case 'new_listing_nearby':
      // Driver taps a "new delivery nearby" notification
      if (deliveryId) {
        console.log('[Nav] Navigate to driver delivery (new listing):', deliveryId);
        navigateFromNotification('DriverDeliveryDetail', { deliveryId });
      }
      break;
    case 'driver_confirmed':
      // Sender gets notified that driver confirmed selection
      if (deliveryId) {
        console.log('[Nav] Navigate to sender delivery (driver confirmed):', deliveryId);
        navigateFromNotification('SenderDeliveryDetail', { deliveryId });
      }
      break;
    case 'driver_declined':
    case 'selection_timeout':
      // Sender needs to pick another driver
      if (deliveryId) {
        console.log('[Nav] Navigate to sender delivery (select new driver):', deliveryId);
        navigateFromNotification('SenderDeliveryDetail', { deliveryId });
      }
      break;
    case 'selection_cancelled':
      // Driver gets notified that sender cancelled selection
      if (deliveryId) {
        console.log('[Nav] Navigate to driver delivery (selection cancelled):', deliveryId);
        navigateFromNotification('DriverDeliveryDetail', { deliveryId });
      }
      break;
    case 'kyc_approved':
    case 'kyc_rejected':
      console.log('[Nav] KYC status notification:', event);
      // No navigation needed — profile screen refreshes on focus
      break;
    default:
      // Fallback: if deliveryId exists, try routing by recipientRole
      if (deliveryId) {
        const fallbackRole = data.recipientRole;
        const fallbackScreen = fallbackRole === 'driver' ? 'DriverDeliveryDetail' : 'SenderDeliveryDetail';
        console.log('[Nav] Fallback navigation for event:', event, '→', fallbackScreen);
        navigateFromNotification(fallbackScreen, { deliveryId });
      } else {
        console.log('[Nav] Unknown notification event, no deliveryId:', event);
      }
  }
}
