/**
 * Notifications Service — שירות התראות
 * FCM token management and local notification handling.
 * Uses @notifee/react-native for local notifications on bare RN.
 * ניהול טוקן FCM וטיפול בהתראות מקומיות
 */

import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

// ──────────────────────────────────────────────
// FCM Token Management
// ──────────────────────────────────────────────

/**
 * Get current FCM token.
 * קבלת טוקן FCM נוכחי
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token;
  } catch (error) {
    console.error('[Notifications] Failed to get FCM token:', error);
    return null;
  }
}

/**
 * Save FCM token to user's Firestore document.
 * שמירת טוקן FCM במסמך המשתמש ב-Firestore
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  await firestore().collection('users').doc(userId).update({
    fcmTokens: firestore.FieldValue.arrayUnion(token),
    lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
    platform: Platform.OS,
  });
}

/**
 * Remove FCM token from user's document (on logout).
 * הסרת טוקן FCM ממסמך המשתמש (בהתנתקות)
 */
export async function removeFCMToken(userId: string, token: string): Promise<void> {
  await firestore().collection('users').doc(userId).update({
    fcmTokens: firestore.FieldValue.arrayRemove(token),
  });
}

// ──────────────────────────────────────────────
// Permission Handling
// ──────────────────────────────────────────────

/**
 * Check if notifications are permitted.
 * בדיקה אם התראות מורשות
 */
export async function checkNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().hasPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Request notification permission from user.
 * בקשת הרשאת התראות מהמשתמש
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.error('[Notifications] Permission request failed:', error);
    return false;
  }
}

// ──────────────────────────────────────────────
// Android Notification Channel
// ──────────────────────────────────────────────

/** Ensure the default Android notification channel exists (required Android 8+) */
async function ensureChannel(): Promise<string> {
  return notifee.createChannel({
    id: 'mooviz-default',
    name: 'MOOVIZ Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

// ──────────────────────────────────────────────
// Local Notifications
// ──────────────────────────────────────────────

/**
 * Show a local notification immediately.
 * הצגת התראה מקומית מיידית
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const channelId = await ensureChannel();
  await notifee.displayNotification({
    title,
    body,
    data,
    android: { channelId, smallIcon: 'ic_launcher', pressAction: { id: 'default' } },
  });
}

/**
 * Schedule a local notification.
 * תזמון התראה מקומית
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  triggerSeconds: number,
  data?: Record<string, string>,
): Promise<string> {
  const channelId = await ensureChannel();
  return await notifee.createTriggerNotification(
    {
      title,
      body,
      data,
      android: { channelId, smallIcon: 'ic_launcher', pressAction: { id: 'default' } },
    },
    {
      type: 0, // TimestampTrigger
      timestamp: Date.now() + triggerSeconds * 1000,
    },
  );
}

/**
 * Cancel all scheduled notifications.
 * ביטול כל ההתראות המתוזמנות
 */
export async function cancelAllNotifications(): Promise<void> {
  await notifee.cancelAllNotifications();
}

/**
 * Set badge count (iOS only).
 * הגדרת ספירת תגיות (iOS בלבד)
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'ios') {
    await notifee.setBadgeCount(count);
  }
}
