/**
 * Firebase Analytics + Crashlytics — שירות אנליטיקס
 * Centralized analytics tracking for screens, events, and crash reporting.
 */
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

/** Set the current user ID for both Analytics and Crashlytics */
export async function setAnalyticsUser(uid: string, role: string): Promise<void> {
  await analytics().setUserId(uid);
  await analytics().setUserProperty('role', role);
  crashlytics().setUserId(uid);
  crashlytics().setAttribute('role', role);
}

/** Clear user on logout */
export async function clearAnalyticsUser(): Promise<void> {
  await analytics().setUserId(null);
  await analytics().setUserProperty('role', null);
}

/** Log screen view */
export async function logScreenView(screenName: string, screenClass?: string): Promise<void> {
  await analytics().logScreenView({
    screen_name: screenName,
    screen_class: screenClass || screenName,
  });
}

/** Log custom event */
export async function logEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  await analytics().logEvent(name, params);
}

// ── Delivery lifecycle events ──

export function logDeliveryCreated(deliveryId: string, price: number): void {
  logEvent('delivery_created', { delivery_id: deliveryId, price });
}

export function logDriverInterested(deliveryId: string): void {
  logEvent('driver_interested', { delivery_id: deliveryId });
}

export function logDeliveryPickedUp(deliveryId: string): void {
  logEvent('delivery_picked_up', { delivery_id: deliveryId });
}

export function logDeliveryCompleted(deliveryId: string, price: number): void {
  logEvent('delivery_completed', { delivery_id: deliveryId, price });
}

export function logPaymentConfirmed(deliveryId: string): void {
  logEvent('payment_confirmed', { delivery_id: deliveryId });
}

// ── Chat events ──

export function logChatMessageSent(chatId: string, hasImage: boolean): void {
  logEvent('chat_message_sent', { chat_id: chatId, has_image: hasImage });
}

// ── Auth events ──

export function logLogin(method: string): void {
  analytics().logLogin({ method });
}

export function logSignUp(method: string): void {
  analytics().logSignUp({ method });
}

// ── Crashlytics helpers ──

/** Record a non-fatal error in Crashlytics */
export function recordError(error: Error, context?: string): void {
  if (context) {
    crashlytics().log(context);
  }
  crashlytics().recordError(error);
}

/** Add a breadcrumb log message to Crashlytics */
export function logCrashlytics(message: string): void {
  crashlytics().log(message);
}
