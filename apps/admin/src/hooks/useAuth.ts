import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { User } from 'firebase/auth';
import {
  AdminUser,
  signIn as authSignIn,
  signOut as authSignOut,
  onAuthChange,
  getAdminProfile,
} from '../services/auth';

interface AuthState {
  user: AdminUser | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
export const AuthProvider = AuthContext.Provider;

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        const profile = await getAdminProfile(fbUser.uid);
        setUser(profile);
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const adminUser = await authSignIn(email, password);
      setUser(adminUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setFirebaseUser(null);
  }, []);

  return { user, firebaseUser, loading, error, signIn, signOut };
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
