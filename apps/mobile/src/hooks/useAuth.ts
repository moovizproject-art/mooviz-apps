import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MoovizUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: 'sender' | 'driver' | 'both';
  city: string | null;
  rating: number | null;
  totalDeliveries: number;
  totalRatings: number;
  kycVerified: boolean;
  createdAt: Date;
}

interface AuthContextValue {
  currentUser: MoovizUser | null;
  isLoading: boolean;
  login: (user: MoovizUser) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: Partial<MoovizUser>) => Promise<void>;
  updateProfile: (data: Partial<MoovizUser>) => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<MoovizUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Listen to Firebase auth state changes
  // האזנה לשינויי מצב אימות של Firebase
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser: FirebaseAuthTypes.User | null) => {
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore
          const doc = await firestore().collection('users').doc(firebaseUser.uid).get();
          if (doc.exists) {
            const data = doc.data();
            setCurrentUser({
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
            });
          } else {
            // New user — create profile placeholder
            setCurrentUser({
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
            });
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

  const login = useCallback(async (user: MoovizUser): Promise<void> => {
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

  const register = useCallback(async (data: Partial<MoovizUser>): Promise<void> => {
    const user = auth().currentUser;
    if (!user) throw new Error('No authenticated user');

    const profile: Record<string, unknown> = {
      uid: user.uid,
      displayName: data.displayName || null,
      email: data.email || user.email,
      phone: data.phone || user.phoneNumber,
      photoUrl: data.photoUrl || null,
      role: data.role || 'sender',
      city: data.city || null,
      rating: null,
      totalDeliveries: 0,
      totalRatings: 0,
      kycVerified: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore().collection('users').doc(user.uid).set(profile, { merge: true });
  }, []);

  const updateProfile = useCallback(async (data: Partial<MoovizUser>): Promise<void> => {
    if (!currentUser) throw new Error('Not authenticated');

    await firestore().collection('users').doc(currentUser.uid).update({
      ...data,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    setCurrentUser((prev) => (prev ? { ...prev, ...data } : prev));
  }, [currentUser]);

  const value: AuthContextValue = {
    currentUser,
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
 * useAuth — הוק אימות
 * Provides access to auth state and methods.
 * מספק גישה למצב אימות ופונקציות
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
