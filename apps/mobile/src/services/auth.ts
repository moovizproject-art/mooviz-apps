/**
 * Auth Service -- email+password registration with phone OTP linking
 */

import { Platform, NativeModules } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
// messaging import removed — not currently used

/** Detect iOS Simulator — verifyPhoneNumber crashes without APNs */
const isIOSSimulator = Platform.OS === 'ios' &&
  NativeModules.PlatformConstants?.interfaceIdiom === 'simulator';

/** Detect Android Emulator — SMS OTP can't be received */
const isAndroidEmulator = Platform.OS === 'android' && __DEV__ && (
  NativeModules.PlatformConstants?.Brand === 'google' ||
  NativeModules.PlatformConstants?.Fingerprint?.includes('generic') ||
  NativeModules.PlatformConstants?.Model?.includes('sdk') ||
  NativeModules.PlatformConstants?.Model?.includes('Emulator')
);

/**
 * Ensure APNs is ready on iOS before calling verifyPhoneNumber.
 * Firebase phone auth requires an APNs token — without it,
 * PhoneAuthProvider.verifyPhoneNumber crashes with EXC_BREAKPOINT.
 *
 * This function:
 * 1. Requests notification permission if not yet granted
 * 2. Registers for remote messages if needed
 * 3. Waits for the APNs token (with timeout)
 */
async function ensureAPNsReady(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  try {
    const messaging = require('@react-native-firebase/messaging').default;

    // Request permission first (no-op if already granted)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === 1 /* AUTHORIZED */ ||
      authStatus === 2 /* PROVISIONAL */;
    if (!enabled) return false;

    // Register for remote messages
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }

    // Wait for APNs token with retry (it can take a moment after registration)
    for (let i = 0; i < 5; i++) {
      const apnsToken = await messaging().getAPNSToken();
      if (apnsToken) return true;
      await new Promise(r => setTimeout(r, 500));
    }

    return false;
  } catch (err) {
    console.error('[ensureAPNsReady] Failed:', err);
    return false;
  }
}

// ──────────────────────────────────────────────
// Error sanitizer — prevent Hermes crash on native errors
// ──────────────────────────────────────────────

/**
 * Convert a native Firebase error into a plain JS Error.
 * Hermes (iOS) can crash with EXC_BREAKPOINT when constructing
 * stack traces for native error objects. Re-throwing as a plain
 * Error avoids the crash while preserving code + message.
 */
function sanitizeFirebaseError(err: unknown): Error {
  if (err instanceof Error) return err;
  const raw = err as { code?: string; message?: string; userInfo?: Record<string, unknown> };
  const msg = raw?.message || raw?.userInfo?.message || 'Unknown Firebase error';
  const sanitized = new Error(String(msg)) as any;
  sanitized.code = raw?.code || raw?.userInfo?.code;
  return sanitized;
}

// ──────────────────────────────────────────────
// Phone normalizer
// ──────────────────────────────────────────────

/**
 * Normalize Israeli phone numbers to E.164 format.
 */
export function normalizePhoneNumber(input: string): string {
  let phone = input.replace(/[\s\-()]/g, '');

  // Israeli number starting with 0 -> +972
  if (phone.startsWith('0')) {
    phone = '+972' + phone.substring(1);
  }

  // If no country code, assume Israeli
  if (!phone.startsWith('+')) {
    phone = '+972' + phone;
  }

  return phone;
}

// ──────────────────────────────────────────────
// Email + Password Auth
// ──────────────────────────────────────────────

/**
 * Step 1: Register with email+password.
 * Sends email verification automatically.
 */
export async function registerWithEmail(
  email: string,
  password: string,
): Promise<FirebaseAuthTypes.UserCredential> {
  try {
    const credential = await auth().createUserWithEmailAndPassword(email, password);
    // Set Hebrew language for Firebase email templates
    auth().languageCode = 'he';
    await credential.user.sendEmailVerification();
    return credential;
  } catch (err: unknown) {
    throw sanitizeFirebaseError(err);
  }
}

/**
 * Login with email+password.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<FirebaseAuthTypes.UserCredential> {
  try {
    return await auth().signInWithEmailAndPassword(email, password);
  } catch (err: unknown) {
    throw sanitizeFirebaseError(err);
  }
}

/**
 * Send password reset email.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  auth().languageCode = 'he';
  await auth().sendPasswordResetEmail(email);
}

// ──────────────────────────────────────────────
// Phone OTP (for linking to existing account)
// ──────────────────────────────────────────────

/**
 * Step 2: Send phone OTP for linking to account.
 * Returns verificationId for use with verifyAndLinkPhone.
 *
 * Prerequisites for SMS OTP to work:
 * 1. Firebase Console → Authentication → Sign-in method → Phone sign-in ENABLED
 * 2. Android: SHA-1 and SHA-256 fingerprints registered in Firebase Console → Project Settings
 * 3. iOS: APNs key or certificate configured for push-based verification
 * 4. For testing: add test phone numbers in Firebase Console → Authentication → Phone → Phone numbers for testing
 *
 * Note: On some RN Firebase versions, verifyPhoneNumber may return a PhoneAuthState
 * object instead of a plain string. If that happens, extract .verificationId from the result.
 */
export async function sendPhoneOTP(phone: string): Promise<string> {
  const normalized = normalizePhoneNumber(phone);
  console.log('[sendPhoneOTP] Sending to:', normalized);

  // Set Hebrew so reCAPTCHA fallback (if triggered) renders in Hebrew
  auth().languageCode = 'he';

  // Emulator bypass: iOS crashes without APNs, Android can't receive SMS.
  if (isIOSSimulator || isAndroidEmulator) {
    console.warn(`[sendPhoneOTP] Emulator detected (${Platform.OS}) — returning test verificationId.`);
    return 'simulator-test-verification-id';
  }

  // iOS: verifyPhoneNumber crashes with EXC_BREAKPOINT if APNs token is missing.
  // Ensure permissions + APNs registration before calling to avoid native crash.
  if (Platform.OS === 'ios') {
    const apnsReady = await ensureAPNsReady();
    if (!apnsReady) {
      console.error('[sendPhoneOTP] APNs token not available — cannot verify phone on iOS');
      throw Object.assign(
        new Error('Push notifications not configured. Please enable notifications for MOOVIZ in Settings and try again.'),
        { code: 'auth/apns-not-available' },
      );
    }
  }

  // On Android, verifyPhoneNumber waits for auto-verification before resolving.
  // Use event-based approach to get verificationId as soon as code is sent.
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('Phone verification timed out. Please try again.'), { code: 'auth/timeout' }));
    }, 30000);

    try {
      const listener = auth().verifyPhoneNumber(normalized);

      listener.on('state_changed', (phoneAuthSnapshot) => {
        console.log('[sendPhoneOTP] state_changed:', phoneAuthSnapshot.state, 'verificationId:', !!phoneAuthSnapshot.verificationId);

        if (phoneAuthSnapshot.state === 'sent' || phoneAuthSnapshot.state === 'timeout') {
          // Code sent — resolve with verificationId so we can navigate to OTP screen
          clearTimeout(timer);
          if (phoneAuthSnapshot.verificationId) {
            resolve(phoneAuthSnapshot.verificationId);
          } else {
            reject(Object.assign(new Error('No verification ID received'), { code: 'auth/missing-verification-id' }));
          }
        } else if (phoneAuthSnapshot.state === 'verified') {
          // Auto-verified (Android read the SMS) — resolve anyway
          clearTimeout(timer);
          resolve(phoneAuthSnapshot.verificationId || 'auto-verified');
        } else if (phoneAuthSnapshot.state === 'error') {
          clearTimeout(timer);
          const err = phoneAuthSnapshot.error || new Error('Phone verification failed');
          reject(sanitizeFirebaseError(err));
        }
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const error = sanitizeFirebaseError(err) as any;
      const msg = error.message || '';
      if (error.code?.includes('17006') || msg.includes('17006') || msg.includes('region')) {
        reject(Object.assign(new Error('SMS region not enabled in Firebase Console'), { code: 'auth/sms-region-not-enabled' }));
      } else {
        reject(error);
      }
    }
  });
}

/**
 * Step 3: Verify phone OTP and link to current account.
 */
export async function verifyAndLinkPhone(
  verificationId: string,
  code: string,
): Promise<void> {
  try {
    // iOS Simulator bypass: skip Firebase phone auth (no APNs), just accept any code.
    // Real device will always have a real verificationId from verifyPhoneNumber().
    if (verificationId === 'simulator-test-verification-id') {
      console.warn('[verifyAndLinkPhone] Simulator mode — skipping Firebase phone credential check');
      return;
    }

    const credential = auth.PhoneAuthProvider.credential(verificationId, code);
    const currentUser = auth().currentUser;
    if (!currentUser) throw new Error('No authenticated user');

    // Check if phone is already linked
    const hasPhone = currentUser.providerData.some(
      (p) => p.providerId === 'phone',
    );

    if (hasPhone) {
      // Phone already linked (2FA re-verification).
      // signInWithCredential with the phone credential returns the same user
      // since the phone is linked to this account. This validates the OTP code.
      await auth().signInWithCredential(credential);
    } else {
      // First time — link phone to the email account
      await currentUser.linkWithCredential(credential);
    }
  } catch (err: unknown) {
    throw sanitizeFirebaseError(err);
  }
}

// ──────────────────────────────────────────────
// Firestore user document
// ──────────────────────────────────────────────

/**
 * Create Firestore user document after registration.
 */
export async function createUserDocument(
  uid: string,
  data: {
    fullName: string;
    email: string;
    phone: string;
    city?: string;
    gender?: 'male' | 'female';
    ageRange?: string;
  },
): Promise<void> {
  await firestore().collection('users').doc(uid).set({
    uid,
    fullName: data.fullName,
    email: data.email,
    phone: normalizePhoneNumber(data.phone),
    city: data.city || '',
    gender: data.gender || '',
    ageRange: data.ageRange || '',
    role: 'sender',
    profilePhotoURL: '',
    kycDocumentURL: '',
    kycStatus: 'pending',
    ratingAsDriver: { average: 0, count: 0 },
    ratingAsSender: { average: 0, count: 0 },
    completedDeliveries: 0,
    status: 'active',
    fcmTokens: [],
    location: { lat: 0, lng: 0, geohash: '' },
    activeMode: 'client',
    driverAvailable: false,
    driverUnlocked: false,
    lastLoginAt: firestore.FieldValue.serverTimestamp(),
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

// ──────────────────────────────────────────────
// Sign out
// ──────────────────────────────────────────────

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await auth().signOut();
}

// ──────────────────────────────────────────────
// Error mapping
// ──────────────────────────────────────────────

/**
 * Map Firebase Auth error codes to Hebrew messages.
 */
export function mapFirebaseAuthError(code: string): string {
  const errors: Record<string, string> = {
    'auth/email-already-in-use': 'כתובת האימייל כבר בשימוש',
    'auth/invalid-email': 'כתובת אימייל לא תקינה',
    'auth/operation-not-allowed': 'הפעולה אינה מורשית',
    'auth/weak-password': 'הסיסמה חלשה מדי (מינימום 8 תווים)',
    'auth/user-disabled': 'החשבון הושעה',
    'auth/user-not-found': 'משתמש לא נמצא — יש להירשם תחילה',
    'auth/wrong-password': 'סיסמה שגויה. ניתן לאפס סיסמה בלחיצה על "שכחתי סיסמה".',
    'auth/invalid-credential': 'אימייל או סיסמה שגויים. אם עדיין לא נרשמת — לחץ על הירשם.',
    'auth/too-many-requests': 'יותר מדי ניסיונות. אנא המתן 15 דקות ונסה שוב.',
    'auth/invalid-verification-code': 'קוד אימות שגוי',
    'auth/invalid-verification-id': 'מזהה אימות לא תקין',
    'auth/credential-already-in-use': 'מספר הטלפון הזה כבר משויך לחשבון אחר. אם זה המספר שלך, התחבר עם החשבון הקיים.',
    'auth/requires-recent-login': 'נדרשת התחברות מחדש',
    'auth/network-request-failed': 'בעיית רשת, בדוק את החיבור לאינטרנט',
    'auth/missing-client-identifier': 'חסר מזהה לקוח. הפעל reCAPTCHA או הוסף SHA-1.',
    'auth/app-not-authorized': 'האפליקציה לא מורשית לשימוש ב-Firebase Auth.',
    'auth/captcha-check-failed': 'בדיקת reCAPTCHA נכשלה.',
    'auth/sms-region-not-enabled': 'שליחת SMS לא מופעלת לאזור זה. יש להפעיל ב-Firebase Console.',
    'auth/timeout': 'אימות הטלפון נכשל. אנא נסה שוב.',
    'auth/apns-not-available': 'התראות לא מוגדרות. אנא אפשר התראות עבור MOOVIZ בהגדרות ונסה שוב.',
  };
  // Handle SMS region error (code 17006)
  if (code.includes('17006') || code.includes('region')) {
    return 'שליחת SMS לא מופעלת לאזור זה. הפעל ב-Firebase Console → Authentication → Settings → SMS Region Policy.';
  }
  return errors[code] || 'שגיאה לא צפויה, נסה שוב';
}
