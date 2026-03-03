/**
 * Auth Service — שירות אימות
 * Authentication functions: send OTP, verify OTP, sign out.
 * פונקציות אימות: שליחת OTP, אימות OTP, התנתקות
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { MoovizUser } from '../hooks/useAuth';

// ──────────────────────────────────────────────
// OTP Authentication
// ──────────────────────────────────────────────

/**
 * Send OTP verification code to phone number.
 * שליחת קוד אימות OTP למספר טלפון
 *
 * @param phoneOrEmail - Phone in E.164 format or email address
 * @returns verificationId for use with verifyOTP
 */
export async function sendOTP(phoneOrEmail: string): Promise<string> {
  // Normalize Israeli phone numbers
  const phone = normalizePhoneNumber(phoneOrEmail);

  const confirmation = await auth().signInWithPhoneNumber(phone);

  if (!confirmation.verificationId) {
    throw new Error('Failed to send verification code');
  }

  return confirmation.verificationId;
}

/**
 * Verify OTP code and sign in.
 * אימות קוד OTP והתחברות
 *
 * @param verificationId - From sendOTP
 * @param code - 6-digit OTP code
 * @returns Authenticated MoovizUser
 */
export async function verifyOTP(verificationId: string, code: string): Promise<MoovizUser> {
  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
  const userCredential = await auth().signInWithCredential(credential);
  const firebaseUser = userCredential.user;

  // Fetch or create user profile
  // שליפה או יצירת פרופיל משתמש
  const userDoc = await firestore().collection('users').doc(firebaseUser.uid).get();

  if (userDoc.exists) {
    const data = userDoc.data();
    return {
      uid: firebaseUser.uid,
      displayName: data?.displayName || firebaseUser.displayName,
      email: data?.email || firebaseUser.email,
      phone: data?.phone || firebaseUser.phoneNumber,
      photoUrl: data?.photoUrl || firebaseUser.photoURL,
      role: data?.role || 'sender',
      city: data?.city || null,
      rating: data?.rating || null,
      totalDeliveries: data?.totalDeliveries || 0,
      totalRatings: data?.totalRatings || 0,
      kycVerified: data?.kycVerified || false,
      createdAt: data?.createdAt?.toDate() || new Date(),
    };
  }

  // First-time user
  // משתמש חדש
  const newUser: MoovizUser = {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    phone: firebaseUser.phoneNumber,
    photoUrl: firebaseUser.photoURL,
    role: 'sender',
    city: null,
    rating: null,
    totalDeliveries: 0,
    totalRatings: 0,
    kycVerified: false,
    createdAt: new Date(),
  };

  return newUser;
}

/**
 * Sign out the current user.
 * התנתקות המשתמש הנוכחי
 */
export async function signOut(): Promise<void> {
  await auth().signOut();
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Normalize Israeli phone numbers to E.164 format.
 * נרמול מספרי טלפון ישראליים לפורמט E.164
 */
function normalizePhoneNumber(input: string): string {
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
