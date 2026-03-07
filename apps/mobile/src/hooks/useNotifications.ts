/**
 * useNotifications — הוק התראות
 * FCM token registration, foreground notification display, and tap handlers.
 * Uses @react-native-firebase/messaging + @notifee for bare RN compatibility.
 * רישום טוקן FCM וטיפול בהתראות
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';

import { useAuth } from './useAuth';
import { playSound } from '../services/sound';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface UseNotificationsResult {
  fcmToken: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

/** Create Android notification channel (required for Android 8+) */
async function ensureAndroidChannel(): Promise<string> {
  return notifee.createChannel({
    id: 'mooviz-default',
    name: 'MOOVIZ Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
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

  // Register FCM token and save to Firestore
  useEffect(() => {
    const registerToken = async (): Promise<void> => {
      try {
        const granted = await requestPermission();
        if (!granted) return;

        const token = await messaging().getToken();
        setFcmToken(token);

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

    return () => unsubscribeTokenRefresh();
  }, [currentUser?.uid, requestPermission]);

  // Handle foreground notifications via notifee
  useEffect(() => {
    const unsubscribeForeground = messaging().onMessage(
      async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('[Notifications] Foreground message:', remoteMessage);

        if (remoteMessage.notification) {
          // Play sound based on notification type
          const notifType = remoteMessage.data?.type as string | undefined;
          if (notifType === 'new_listing_nearby') playSound('new_delivery');
          else if (notifType === 'driver_interested') playSound('driver_interested');
          else if (notifType === 'payment_confirmed') playSound('payment');
          else playSound('success');

          const channelId = await ensureAndroidChannel();

          await notifee.displayNotification({
            title: remoteMessage.notification.title || 'MOOVIZ',
            body: remoteMessage.notification.body || '',
            data: remoteMessage.data as Record<string, string>,
            android: { channelId, smallIcon: 'ic_launcher', pressAction: { id: 'default' } },
          });
        }
      },
    );

    // Background/quit notification tap handler
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

    return () => unsubscribeForeground();
  }, []);

  return { fcmToken, hasPermission, requestPermission };
}

/**
 * Handle navigation from notification tap.
 * ניווט מלחיצה על התראה
 */
function handleNotificationNavigation(data?: Record<string, string>): void {
  if (!data) return;

  const { type, deliveryId, chatId } = data;

  switch (type) {
    case 'delivery_update':
      console.log('[Nav] Navigate to delivery:', deliveryId);
      break;
    case 'new_message':
      console.log('[Nav] Navigate to chat:', chatId);
      break;
    case 'new_interest':
      console.log('[Nav] Navigate to delivery interests:', deliveryId);
      break;
    default:
      console.log('[Nav] Unknown notification type:', type);
  }
}
