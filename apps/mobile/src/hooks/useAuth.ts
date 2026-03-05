import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { User } from '../types';

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

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (fbUser: FirebaseAuthTypes.User | null) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // Fetch user profile from Firestore
          const doc = await firestore().collection('users').doc(fbUser.uid).get();
          if (doc.exists) {
            const data = doc.data();
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
              ratingAsDriver: data?.ratingAsDriver || { average: 0, count: 0 },
              ratingAsSender: data?.ratingAsSender || { average: 0, count: 0 },
              completedDeliveries: data?.completedDeliveries || 0,
              status: data?.status || 'active',
              fcmTokens: data?.fcmTokens || [],
              location: data?.location || { lat: 0, lng: 0, geohash: '' },
              migratedFrom: data?.migratedFrom,
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
