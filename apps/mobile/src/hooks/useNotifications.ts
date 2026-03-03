import { useState, useEffect, useCallback, useRef } from 'react';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import firestore from '@react-native-firebase/firestore';

import { useAuth } from './useAuth';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface UseNotificationsResult {
  fcmToken: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

// Configure notification handling behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * useNotifications — הוק התראות
 * FCM token registration and notification handlers.
 * רישום טוקן FCM וטיפול בהתראות
 */
export function useNotifications(): UseNotificationsResult {
  const { currentUser } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Request notification permissions
  // בקשת הרשאות התראות
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
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

  // Register FCM token
  // רישום טוקן FCM
  useEffect(() => {
    const registerToken = async (): Promise<void> => {
      try {
        const granted = await requestPermission();
        if (!granted) return;

        const token = await messaging().getToken();
        setFcmToken(token);

        // Save token to Firestore user doc
        if (currentUser?.uid && token) {
          await firestore().collection('users').doc(currentUser.uid).update({
            fcmTokens: firestore.FieldValue.arrayUnion(token),
            lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('[useNotifications] Token registration error:', error);
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

    return () => {
      unsubscribeTokenRefresh();
    };
  }, [currentUser?.uid, requestPermission]);

  // Handle foreground notifications
  // טיפול בהתראות בזמן שהאפליקציה פעילה
  useEffect(() => {
    // Foreground message handler
    const unsubscribeForeground = messaging().onMessage(
      async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('[Notifications] Foreground message:', remoteMessage);

        // Show local notification
        if (remoteMessage.notification) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: remoteMessage.notification.title || 'MOOVIZ',
              body: remoteMessage.notification.body || '',
              data: remoteMessage.data as Record<string, string>,
            },
            trigger: null, // Show immediately
          });
        }
      },
    );

    // Background/quit notification tap handler
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[Notifications] Opened from background:', remoteMessage);
      handleNotificationNavigation(remoteMessage.data);
    });

    // Check if app was opened by a notification from quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[Notifications] Opened from quit state:', remoteMessage);
          handleNotificationNavigation(remoteMessage.data);
        }
      });

    // Local notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Notifications] Local received:', notification);
      },
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[Notifications] User tapped:', response);
        handleNotificationNavigation(response.notification.request.content.data);
      },
    );

    return () => {
      unsubscribeForeground();
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return { fcmToken, hasPermission, requestPermission };
}

/**
 * Handle navigation from notification tap.
 * ניווט מלחיצה על התראה
 */
function handleNotificationNavigation(data?: Record<string, string>): void {
  if (!data) return;

  // TODO: Implement deep navigation based on notification type
  // TODO: ניווט עמוק לפי סוג ההתראה
  const { type, deliveryId, chatId } = data;

  switch (type) {
    case 'delivery_update':
      // Navigate to delivery detail
      console.log('[Nav] Navigate to delivery:', deliveryId);
      break;
    case 'new_message':
      // Navigate to chat
      console.log('[Nav] Navigate to chat:', chatId);
      break;
    case 'new_interest':
      // Navigate to delivery detail to see interested drivers
      console.log('[Nav] Navigate to delivery interests:', deliveryId);
      break;
    default:
      console.log('[Nav] Unknown notification type:', type);
  }
}
