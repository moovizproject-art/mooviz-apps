/**
 * Auth Service -- email+password registration with phone OTP linking
 */

import { Platform, NativeModules } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

/** Detect iOS Simulator — verifyPhoneNumber crashes without APNs */
const isIOSSimulator = Platform.OS === 'ios' && (
  NativeModules.PlatformConstants?.interfaceIdiom === 'simulator' ||
  __DEV__ && !NativeModules.RNFBMessagingModule?.isDeviceRegisteredForRemoteMessages
);

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

  try {
    // iOS Simulator: verifyPhoneNumber crashes Hermes (no APNs support).
    // Return a placeholder verificationId so user can still navigate to OTP screen
    // and enter Firebase Console test phone code (e.g. 123456).
    if (isIOSSimulator) {
      console.warn('[sendPhoneOTP] iOS Simulator detected — returning test verificationId. Use Firebase Console test phone numbers.');
      return 'simulator-test-verification-id';
    }

    const result = await auth().verifyPhoneNumber(normalized);
    console.log('[sendPhoneOTP] Result type:', typeof result, result);
    if (typeof result === 'string') {
      return result;
    }
    // On Android, result may be an object with verificationId
    return (result as any).verificationId || String(result);
  } catch (err: unknown) {
    // Sanitize native error → plain JS Error to prevent Hermes EXC_BREAKPOINT crash
    const error = sanitizeFirebaseError(err) as any;
    console.log('[sendPhoneOTP] Error:', error.code, error.message);
    // Map known error codes
    const msg = error.message || '';
    if (error.code?.includes('17006') || msg.includes('17006') || msg.includes('region')) {
      const regionError = new Error('SMS region not enabled in Firebase Console') as any;
      regionError.code = 'auth/sms-region-not-enabled';
      throw regionError;
    }
    throw error;
  }
}

/**
 * Step 3: Verify phone OTP and link to current account.
 */
export async function verifyAndLinkPhone(
  verificationId: string,
  code: string,
): Promise<void> {
  try {
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
  },
): Promise<void> {
  await firestore().collection('users').doc(uid).set({
    uid,
    fullName: data.fullName,
    email: data.email,
    phone: normalizePhoneNumber(data.phone),
    city: data.city || '',
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
    'auth/user-not-found': 'משתמש לא נמצא',
    'auth/wrong-password': 'סיסמה שגויה',
    'auth/too-many-requests': 'יותר מדי ניסיונות, נסה שוב מאוחר יותר',
    'auth/invalid-verification-code': 'קוד אימות שגוי',
    'auth/invalid-verification-id': 'מזהה אימות לא תקין',
    'auth/credential-already-in-use': 'פרטי ההתחברות כבר בשימוש',
    'auth/requires-recent-login': 'נדרשת התחברות מחדש',
    'auth/network-request-failed': 'בעיית רשת, בדוק את החיבור לאינטרנט',
    'auth/missing-client-identifier': 'חסר מזהה לקוח. הפעל reCAPTCHA או הוסף SHA-1.',
    'auth/app-not-authorized': 'האפליקציה לא מורשית לשימוש ב-Firebase Auth.',
    'auth/captcha-check-failed': 'בדיקת reCAPTCHA נכשלה.',
    'auth/sms-region-not-enabled': 'שליחת SMS לא מופעלת לאזור זה. יש להפעיל ב-Firebase Console.',
  };
  // Handle SMS region error (code 17006)
  if (code.includes('17006') || code.includes('region')) {
    return 'שליחת SMS לא מופעלת לאזור זה. הפעל ב-Firebase Console → Authentication → Settings → SMS Region Policy.';
  }
  return errors[code] || 'שגיאה לא צפויה, נסה שוב';
}
