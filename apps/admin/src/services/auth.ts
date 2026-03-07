import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'moderator';
}

export async function signIn(email: string, password: string): Promise<AdminUser> {
  console.log('[Admin Auth] Attempting sign in for:', email);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  console.log('[Admin Auth] Firebase Auth success, uid:', credential.user.uid);

  const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
  console.log('[Admin Auth] Firestore doc exists:', userDoc.exists());

  if (!userDoc.exists()) {
    await firebaseSignOut(auth);
    throw new Error('User profile not found');
  }

  const userData = userDoc.data();
  console.log('[Admin Auth] User data role:', userData.role, 'all fields:', JSON.stringify(userData));

  if (userData.role !== 'admin' && userData.role !== 'moderator') {
    console.log('[Admin Auth] REJECTED — role is:', userData.role);
    await firebaseSignOut(auth);
    throw new Error('Insufficient permissions. Admin access required.');
  }

  return {
    uid: credential.user.uid,
    email: credential.user.email ?? '',
    displayName: credential.user.displayName,
    role: userData.role,
  };
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function getAdminProfile(uid: string): Promise<AdminUser | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;

  const data = userDoc.data();
  if (data.role !== 'admin' && data.role !== 'moderator') return null;

  return {
    uid,
    email: data.email ?? '',
    displayName: data.displayName ?? null,
    role: data.role,
  };
}
