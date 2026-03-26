import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { setAnalyticsUser, clearAnalyticsUser } from '../services/analytics';

const SESSION_MAX_DAYS = 30;

/** Safely convert a Firestore Timestamp (or Date) to a JS Date. Returns undefined on failure. */
function safeToDate(val: unknown): Date | undefined {
  try {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    if (typeof (val as any).toDate === 'function') return (val as any).toDate();
  } catch {
    // Malformed timestamp — swallow rather than crash Hermes
  }
  return undefined;
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface AuthContextValue {
  currentUser: User | null;
  firebaseUser: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: Partial<User>) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshFirebaseUser: () => Promise<void>;
  refreshUserDoc: () => Promise<void>;
  forceOtp: boolean;
  setForceOtp: (val: boolean) => void;
}

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, setRefreshTick] = useState(0);
  const [forceOtp, setForceOtp] = useState<boolean>(false);

  // Listen to Firebase auth state changes
  // Race-condition guard: on Android, onAuthStateChanged can fire with null
  // before the native SDK finishes restoring the persisted session. We delay
  // committing to "no user" for up to 2s to let the real user arrive.
  useEffect(() => {
    console.log('[useAuth] Setting up onAuthStateChanged listener');
    let nullTimer: ReturnType<typeof setTimeout> | null = null;
    let gotUser = false;

    const unsubscribe = auth().onAuthStateChanged(async (fbUser: FirebaseAuthTypes.User | null) => {
      console.log('[useAuth] onAuthStateChanged fired, user:', fbUser?.uid || 'null');

      if (fbUser) {
        gotUser = true;
        if (nullTimer) { clearTimeout(nullTimer); nullTimer = null; }
        setFirebaseUser(fbUser);

        try {
          // Fetch user profile from Firestore (retry once on permission-denied — can happen during auth token refresh)
          let doc;
          try {
            doc = await firestore().collection('users').doc(fbUser.uid).get();
          } catch (retryErr: any) {
            if (retryErr?.code === 'firestore/permission-denied') {
              console.log('[useAuth] Permission denied, retrying after token refresh...');
              await fbUser.getIdToken(true); // force token refresh
              doc = await firestore().collection('users').doc(fbUser.uid).get();
            } else {
              throw retryErr;
            }
          }
          if (doc.exists) {
            const data = doc.data();

            // Check session expiry — 30 days if "remember me", 1 day otherwise
            const lastLogin = safeToDate(data?.lastLoginAt);
            if (lastLogin) {
              const rememberMe = await AsyncStorage.getItem('@remember_me');
              const maxDays = rememberMe === 'true' ? SESSION_MAX_DAYS : 1;
              const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
              if (daysSinceLogin > maxDays) {
                console.log('[useAuth] Session expired after', Math.floor(daysSinceLogin), 'days (max:', maxDays, ')');
                await auth().signOut();
                setCurrentUser(null);
                setFirebaseUser(null);
                setIsLoading(false);
                return;
              }
            }

            setCurrentUser({
              uid: fbUser.uid,
              fullName: data?.fullName || fbUser.displayName || '',
              email: data?.email || fbUser.email,
              phone: data?.phone || fbUser.phoneNumber,
              profilePhotoURL: data?.profilePhotoURL || fbUser.photoURL || null,
              role: data?.role || 'sender',
              activeMode: data?.activeMode || 'client',
              driverAvailable: data?.driverAvailable || false,
              driverUnlocked: data?.driverUnlocked || false,
              city: data?.city || null,
              kycStatus: data?.kycStatus || 'pending',
              kycDocumentURL: data?.kycDocumentURL || null,
              kycIdURL: data?.kycIdURL || null,
              ratingAsDriver: data?.ratingAsDriver || { average: 0, count: 0 },
              ratingAsSender: data?.ratingAsSender || { average: 0, count: 0 },
              completedDeliveries: data?.completedDeliveries || 0,
              status: data?.status || 'active',
              fcmTokens: data?.fcmTokens || [],
              location: data?.location || { lat: 0, lng: 0, geohash: '' },
              nickname: data?.nickname || '',
              gender: data?.gender || '',
              ageRange: data?.ageRange || '',
              migratedFrom: data?.migratedFrom,
              acceptedTermsAt: safeToDate(data?.acceptedTermsAt),
              lastOtpAt: safeToDate(data?.lastOtpAt),
              createdAt: safeToDate(data?.createdAt) || new Date(),
              updatedAt: safeToDate(data?.updatedAt),
            });
            // Set user identity for Analytics + Crashlytics
            setAnalyticsUser(fbUser.uid, data?.role || 'sender').catch(() => {});
          } else {
            // User exists in Auth but not in Firestore — auto-create a minimal doc
            // This prevents users from being stuck after a failed registration
            console.warn('[useAuth] Auth user has no Firestore doc — auto-creating for', fbUser.uid);
            const autoProfile: Record<string, unknown> = {
              uid: fbUser.uid,
              fullName: fbUser.displayName || '',
              email: fbUser.email || '',
              phone: fbUser.phoneNumber || '',
              city: '',
              role: 'sender',
              activeMode: 'client',
              profilePhotoURL: fbUser.photoURL || '',
              kycStatus: 'pending',
              kycDocumentURL: '',
              ratingAsDriver: { average: 0, count: 0 },
              ratingAsSender: { average: 0, count: 0 },
              completedDeliveries: 0,
              status: 'active',
              fcmTokens: [],
              location: { lat: 0, lng: 0, geohash: '' },
              driverAvailable: false,
              driverUnlocked: false,
              gender: '',
              ageRange: '',
              autoCreated: true, // Flag for admin to identify auto-created users
              // If phone already linked, stamp OTP so they don't get stuck at verification
              ...(fbUser.phoneNumber ? { lastOtpAt: firestore.FieldValue.serverTimestamp() } : {}),
              createdAt: firestore.FieldValue.serverTimestamp(),
              updatedAt: firestore.FieldValue.serverTimestamp(),
            };
            try {
              await firestore().collection('users').doc(fbUser.uid).set(autoProfile, { merge: true });
              setCurrentUser({
                uid: fbUser.uid,
                fullName: (autoProfile.fullName as string) || '',
                email: (autoProfile.email as string) || '',
                phone: (autoProfile.phone as string) || '',
                profilePhotoURL: (autoProfile.profilePhotoURL as string) || null,
                role: 'sender',
                activeMode: 'client',
                driverAvailable: false,
                driverUnlocked: false,
                city: null,
                kycStatus: 'pending',
                kycDocumentURL: null,
                kycIdURL: null,
                ratingAsDriver: { average: 0, count: 0 },
                ratingAsSender: { average: 0, count: 0 },
                completedDeliveries: 0,
                status: 'active',
                fcmTokens: [],
                location: { lat: 0, lng: 0, geohash: '' },
                gender: '',
                ageRange: '',
                lastOtpAt: fbUser.phoneNumber ? new Date() : undefined,
                createdAt: new Date(),
              });
            } catch (autoCreateErr) {
              console.error('[useAuth] Failed to auto-create user doc:', autoCreateErr);
              setCurrentUser(null);
            }
          }
        } catch (error) {
          console.error('[useAuth] Error fetching user profile:', error);
          setCurrentUser(null);
        }
        console.log('[useAuth] Setting isLoading=false (user found)');
        setIsLoading(false);
      } else {
        // Null user — but might be a race condition on Android.
        // If we already had a user, this is a real sign-out.
        // If this is the first callback, wait briefly for the real user.
        setFirebaseUser(null);
        setCurrentUser(null);
        if (gotUser) {
          // Real sign-out after having a user
          console.log('[useAuth] User signed out');
          setIsLoading(false);
        } else if (!nullTimer) {
          // First null callback — wait for native SDK to restore session
          console.log('[useAuth] First null callback — waiting for session restore...');
          nullTimer = setTimeout(() => {
            console.log('[useAuth] Session restore timeout — no user, showing login');
            setIsLoading(false);
            nullTimer = null;
          }, 2000);
        }
      }
    });

    return () => {
      unsubscribe();
      if (nullTimer) clearTimeout(nullTimer);
    };
  }, []);

  const login = useCallback(async (user: User): Promise<void> => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await clearAnalyticsUser().catch(() => {});

      // Remove FCM token from Firestore BEFORE signing out (prevents cross-user token reuse)
      const uid = auth().currentUser?.uid;
      if (uid) {
        try {
          const token = await messaging().getToken();
          if (token) {
            await firestore().collection('users').doc(uid).update({
              fcmTokens: firestore.FieldValue.arrayRemove(token),
            });
            console.log('[useAuth] FCM token removed from Firestore');
          }
          // Delete the token from the device so next user gets a fresh one
          await messaging().deleteToken();
          console.log('[useAuth] FCM token deleted from device');
        } catch (tokenErr) {
          console.warn('[useAuth] FCM token cleanup failed (non-critical):', tokenErr);
        }
      }

      await auth().signOut();
      // Terminate Firestore then clear cache to prevent stale data on next login
      try {
        await firestore().terminate();
        await firestore().clearPersistence();
      } catch (_) {
        // Non-critical — cache will be refreshed by listeners on next login
      }
      setCurrentUser(null);
    } catch (error) {
      console.error('[useAuth] Logout error:', error);
      throw error;
    }
  }, []);

  const register = useCallback(async (data: Partial<User>): Promise<void> => {
    const user = auth().currentUser;
    if (!user) throw new Error('No authenticated user');

    const profile: Record<string, unknown> = {
      uid: user.uid,
      fullName: data.fullName || '',
      email: data.email || user.email,
      phone: data.phone || user.phoneNumber,
      profilePhotoURL: data.profilePhotoURL || '',
      role: 'sender',
      activeMode: data.activeMode || 'client',
      driverAvailable: false,
      driverUnlocked: false,
      city: data.city || '',
      kycStatus: 'pending',
      kycDocumentURL: '',
      kycIdURL: '',
      ratingAsDriver: { average: 0, count: 0 },
      ratingAsSender: { average: 0, count: 0 },
      completedDeliveries: 0,
      status: 'active',
      fcmTokens: [],
      location: { lat: 0, lng: 0, geohash: '' },
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore().collection('users').doc(user.uid).set(profile, { merge: true });
  }, []);

  const refreshFirebaseUser = useCallback(async (): Promise<void> => {
    const user = auth().currentUser;
    if (user) {
      await user.reload();
      // reload() updates properties in-place on the same object reference.
      // Bump a tick counter to force React to re-render with fresh values.
      setFirebaseUser(auth().currentUser);
      setRefreshTick((n) => n + 1);
    }
  }, []);

  const refreshUserDoc = useCallback(async (): Promise<void> => {
    const user = auth().currentUser;
    if (!user) return;
    const doc = await firestore().collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      // Full reload from Firestore — refreshes ALL fields
      setCurrentUser({
        uid: user.uid,
        fullName: data?.fullName || user.displayName || '',
        email: data?.email || user.email,
        phone: data?.phone || user.phoneNumber,
        profilePhotoURL: data?.profilePhotoURL || user.photoURL || null,
        role: data?.role || 'sender',
        activeMode: data?.activeMode || 'client',
        driverAvailable: data?.driverAvailable || false,
        driverUnlocked: data?.driverUnlocked || false,
        city: data?.city || null,
        kycStatus: data?.kycStatus || 'pending',
        kycDocumentURL: data?.kycDocumentURL || null,
        kycIdURL: data?.kycIdURL || null,
        ratingAsDriver: data?.ratingAsDriver || { average: 0, count: 0 },
        ratingAsSender: data?.ratingAsSender || { average: 0, count: 0 },
        completedDeliveries: data?.completedDeliveries || 0,
        status: data?.status || 'active',
        fcmTokens: data?.fcmTokens || [],
        location: data?.location || { lat: 0, lng: 0, geohash: '' },
        gender: data?.gender || '',
        ageRange: data?.ageRange || '',
        migratedFrom: data?.migratedFrom,
        acceptedTermsAt: safeToDate(data?.acceptedTermsAt),
        lastOtpAt: safeToDate(data?.lastOtpAt),
        createdAt: safeToDate(data?.createdAt) || new Date(),
        updatedAt: safeToDate(data?.updatedAt),
      });
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>): Promise<void> => {
    if (!currentUser) throw new Error('Not authenticated');

    await firestore().collection('users').doc(currentUser.uid).update({
      ...data,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    setCurrentUser((prev) => (prev ? { ...prev, ...data } : prev));
  }, [currentUser]);

  // Profile is complete when the user has at least a name and phone number.
  // Auto-created users (Auth without Firestore doc) will have empty values.
  const isProfileComplete = !!(currentUser?.fullName && currentUser?.phone);

  const value: AuthContextValue = {
    currentUser,
    firebaseUser,
    isLoading,
    isProfileComplete,
    login,
    logout,
    register,
    updateProfile,
    refreshFirebaseUser,
    refreshUserDoc,
    forceOtp,
    setForceOtp,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

/**
 * useAuth -- hook for authentication
 * Provides access to auth state and methods.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
