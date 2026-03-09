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
  const credential = await signInWithEmailAndPassword(auth, email, password);

  const userDoc = await getDoc(doc(db, 'users', credential.user.uid));

  if (!userDoc.exists()) {
    await firebaseSignOut(auth);
    throw new Error('User profile not found');
  }

  const userData = userDoc.data();

  if (userData.role !== 'admin' && userData.role !== 'moderator') {
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
