import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type UserRole = 'sender' | 'driver' | 'both' | 'admin' | 'moderator';
export type UserStatus = 'active' | 'suspended' | 'blocked' | 'pending_kyc';
export type KycStatus = 'pending' | 'approved' | 'rejected';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  photoURL: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp | null;
  deliveryCount: number;
  rating: number;
}

export interface UsersQueryParams {
  role?: UserRole;
  status?: UserStatus;
  kycStatus?: KycStatus;
  search?: string;
  pageSize?: number;
  lastDoc?: DocumentSnapshot;
}

const usersRef = collection(db, 'users');

export async function getUsers(params: UsersQueryParams = {}): Promise<{
  users: AppUser[];
  lastDoc: DocumentSnapshot | null;
}> {
  const constraints = [];

  if (params.role) {
    constraints.push(where('role', '==', params.role));
  }
  if (params.status) {
    constraints.push(where('status', '==', params.status));
  }
  if (params.kycStatus) {
    constraints.push(where('kycStatus', '==', params.kycStatus));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(params.pageSize ?? 20));

  if (params.lastDoc) {
    constraints.push(startAfter(params.lastDoc));
  }

  const q = query(usersRef, ...constraints);
  const snapshot = await getDocs(q);

  const users = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as AppUser[];

  const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;

  return { users, lastDoc };
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  const docSnap = await getDoc(doc(db, 'users', userId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as AppUser;
}

export async function approveKyc(userId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    kycStatus: 'approved',
    status: 'active',
    kycReviewedAt: Timestamp.now(),
  });
}

export async function rejectKyc(userId: string, reason: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    kycStatus: 'rejected',
    kycRejectionReason: reason,
    kycReviewedAt: Timestamp.now(),
  });
}

export async function suspendUser(userId: string, reason: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    status: 'suspended',
    suspensionReason: reason,
    suspendedAt: Timestamp.now(),
  });
}

export async function blockUser(userId: string, reason: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    status: 'blocked',
    blockReason: reason,
    blockedAt: Timestamp.now(),
  });
}

export async function reactivateUser(userId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    status: 'active',
    suspensionReason: null,
    suspendedAt: null,
    blockReason: null,
    blockedAt: null,
  });
}
