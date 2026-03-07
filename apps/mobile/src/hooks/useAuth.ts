import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { User } from '../types';

const SESSION_MAX_DAYS = 30;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface AuthContextValue {
  currentUser: User | null;
  firebaseUser: FirebaseAuthTypes.User | null;
  isLoading: boolean;
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
  useEffect(() => {
    console.log('[useAuth] Setting up onAuthStateChanged listener');
    const unsubscribe = auth().onAuthStateChanged(async (fbUser: FirebaseAuthTypes.User | null) => {
      console.log('[useAuth] onAuthStateChanged fired, user:', fbUser?.uid || 'null');
      setFirebaseUser(fbUser);

      if (fbUser) {
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

            // Check 30-day session expiry
            const lastLogin = data?.lastLoginAt?.toDate();
            if (lastLogin) {
              const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
              if (daysSinceLogin > SESSION_MAX_DAYS) {
                console.log('[useAuth] Session expired after', Math.floor(daysSinceLogin), 'days');
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
              migratedFrom: data?.migratedFrom,
              lastOtpAt: data?.lastOtpAt?.toDate() || undefined,
              createdAt: data?.createdAt?.toDate() || new Date(),
              updatedAt: data?.updatedAt?.toDate(),
            });
          } else {
            // User exists in Auth but not in Firestore yet (mid-registration)
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('[useAuth] Error fetching user profile:', error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      console.log('[useAuth] Setting isLoading=false');
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (user: User): Promise<void> => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await auth().signOut();
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
      // Full reload — handles both existing users (partial update) and new
      // registrations where currentUser is still null after OTP verification.
      setCurrentUser((prev) => {
        const base = prev || {
          uid: user.uid,
          fullName: data?.fullName || '',
          email: data?.email || user.email || '',
          phone: data?.phone || user.phoneNumber || '',
          city: data?.city || '',
          role: data?.role || 'sender',
          activeMode: data?.activeMode || 'sender',
          profilePhotoURL: data?.profilePhotoURL || '',
          kycStatus: data?.kycStatus || 'pending',
          rating: data?.rating || { average: 0, count: 0 },
          completedDeliveries: data?.completedDeliveries || 0,
          status: data?.status || 'active',
          createdAt: data?.createdAt?.toDate() || new Date(),
        };
        return {
          ...base,
          lastOtpAt: data?.lastOtpAt?.toDate() || undefined,
          updatedAt: data?.updatedAt?.toDate(),
        };
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

  const value: AuthContextValue = {
    currentUser,
    firebaseUser,
    isLoading,
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
