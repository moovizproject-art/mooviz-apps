/**
 * Auth Service -- email+password registration with phone OTP linking
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

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
  const credential = await auth().createUserWithEmailAndPassword(email, password);
  await credential.user.sendEmailVerification();
  return credential;
}

/**
 * Login with email+password.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<FirebaseAuthTypes.UserCredential> {
  return auth().signInWithEmailAndPassword(email, password);
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
 */
export async function sendPhoneOTP(phone: string): Promise<string> {
  const normalized = normalizePhoneNumber(phone);
  const confirmation = await auth().verifyPhoneNumber(normalized);
  return confirmation;
}

/**
 * Step 3: Verify phone OTP and link to current account.
 */
export async function verifyAndLinkPhone(
  verificationId: string,
  code: string,
): Promise<void> {
  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('No authenticated user');
  await currentUser.linkWithCredential(credential);
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
  };
  return errors[code] || 'שגיאה לא צפויה, נסה שוב';
}
