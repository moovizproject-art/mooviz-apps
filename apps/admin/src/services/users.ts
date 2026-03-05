import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
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
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  city: string;
  role: UserRole;
  activeMode: 'sender' | 'driver' | null;
  status: UserStatus;
  kycStatus: KycStatus;
  kycDocumentURL: string | null;
  kycRejectionReason: string | null;
  driverUnlocked: boolean;
  profilePhotoURL: string | null;
  photoURL: string | null;
  ratingAsDriver: { average: number; count: number } | null;
  ratingAsSender: { average: number; count: number } | null;
  rating: number;
  completedDeliveries: number;
  deliveryCount: number;
  migratedFrom: string | null;
  passwordSetUp: boolean;
  createdAt: Timestamp;
  lastActiveAt: Timestamp | null;
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

function normalizeUser(docSnap: DocumentSnapshot): AppUser {
  const data = docSnap.data() ?? {};
  const ratingAsDriver = data.ratingAsDriver ?? null;
  const ratingAsSender = data.ratingAsSender ?? null;
  const driverAvg = ratingAsDriver?.average ?? 0;
  const senderAvg = ratingAsSender?.average ?? 0;
  const avgRating = driverAvg || senderAvg
    ? ((driverAvg + senderAvg) / (driverAvg && senderAvg ? 2 : 1))
    : 0;

  return {
    id: docSnap.id,
    fullName: data.fullName ?? data.displayName ?? '',
    displayName: data.displayName ?? data.fullName ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    city: data.city ?? '',
    role: data.role ?? 'sender',
    activeMode: data.activeMode ?? null,
    status: data.status ?? 'active',
    kycStatus: data.kycStatus ?? 'pending',
    kycDocumentURL: data.kycDocumentURL ?? null,
    kycRejectionReason: data.kycRejectionReason ?? null,
    driverUnlocked: data.driverUnlocked ?? false,
    profilePhotoURL: data.profilePhotoURL ?? null,
    photoURL: data.profilePhotoURL ?? data.photoURL ?? null,
    ratingAsDriver,
    ratingAsSender,
    rating: avgRating,
    completedDeliveries: data.completedDeliveries ?? 0,
    deliveryCount: data.completedDeliveries ?? data.deliveryCount ?? 0,
    migratedFrom: data.migratedFrom ?? null,
    passwordSetUp: data.passwordSetUp ?? true,
    createdAt: data.createdAt ?? Timestamp.now(),
    lastActiveAt: data.lastActiveAt ?? null,
  };
}

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
  constraints.push(limit(params.pageSize ?? 50));

  if (params.lastDoc) {
    constraints.push(startAfter(params.lastDoc));
  }

  const q = query(usersRef, ...constraints);
  const snapshot = await getDocs(q);

  const users = snapshot.docs.map(normalizeUser);
  const lastDocSnap = snapshot.docs[snapshot.docs.length - 1] ?? null;

  return { users, lastDoc: lastDocSnap };
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  const docSnap = await getDoc(doc(db, 'users', userId));
  if (!docSnap.exists()) return null;
  return normalizeUser(docSnap);
}

export async function searchUsers(searchQuery: string): Promise<AppUser[]> {
  // Firestore does not support full-text search natively.
  // We fetch recent users and filter client-side for the admin panel.
  // For production scale, consider Algolia or Typesense.
  const q = query(usersRef, orderBy('createdAt', 'desc'), limit(200));
  const snapshot = await getDocs(q);
  const lower = searchQuery.toLowerCase();

  return snapshot.docs
    .map(normalizeUser)
    .filter(
      (u) =>
        u.fullName.toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower) ||
        u.phone.includes(searchQuery),
    );
}

export async function updateUserStatus(userId: string, status: UserStatus): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    status,
    updatedAt: Timestamp.now(),
  });
}

export async function updateKycStatus(
  userId: string,
  kycStatus: KycStatus,
  adminId: string,
  reason?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    kycStatus,
    kycReviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (kycStatus === 'approved') {
    updates.driverUnlocked = true;
    updates.status = 'active';
  } else if (kycStatus === 'rejected') {
    updates.kycRejectionReason = reason ?? '';
    updates.driverUnlocked = false;
  }

  await updateDoc(doc(db, 'users', userId), updates);

  // Log admin action
  await addDoc(collection(db, 'adminActions'), {
    adminId,
    action: kycStatus === 'approved' ? 'kyc_approved' : 'kyc_rejected',
    targetUserId: userId,
    details: {
      kycStatus,
      reason: reason ?? null,
    },
    timestamp: Timestamp.now(),
  });
}

export async function approveKyc(userId: string, adminId?: string): Promise<void> {
  await updateKycStatus(userId, 'approved', adminId ?? 'system');
}

export async function rejectKyc(userId: string, reason: string, adminId?: string): Promise<void> {
  await updateKycStatus(userId, 'rejected', adminId ?? 'system', reason);
}

export async function suspendUser(userId: string, reason: string, adminId?: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    status: 'suspended',
    suspensionReason: reason,
    suspendedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  if (adminId) {
    await addDoc(collection(db, 'adminActions'), {
      adminId,
      action: 'user_suspended',
      targetUserId: userId,
      details: { reason },
      timestamp: Timestamp.now(),
    });
  }
}

export async function blockUser(userId: string, reason: string, adminId?: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    status: 'blocked',
    blockReason: reason,
    blockedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  if (adminId) {
    await addDoc(collection(db, 'adminActions'), {
      adminId,
      action: 'user_blocked',
      targetUserId: userId,
      details: { reason },
      timestamp: Timestamp.now(),
    });
  }
}

export async function reactivateUser(userId: string, adminId?: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    status: 'active',
    suspensionReason: null,
    suspendedAt: null,
    blockReason: null,
    blockedAt: null,
    updatedAt: Timestamp.now(),
  });

  if (adminId) {
    await addDoc(collection(db, 'adminActions'), {
      adminId,
      action: 'user_reactivated',
      targetUserId: userId,
      details: {},
      timestamp: Timestamp.now(),
    });
  }
}

export async function getRecentUsers(count: number = 10): Promise<AppUser[]> {
  const q = query(usersRef, orderBy('createdAt', 'desc'), limit(count));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(normalizeUser);
}

export async function getMigratedUsersCount(): Promise<{
  totalMigrated: number;
  pendingPassword: number;
  missingPhone: number;
}> {
  const q = query(usersRef, where('migratedFrom', '==', 'glide'));
  const snapshot = await getDocs(q);

  let pendingPassword = 0;
  let missingPhone = 0;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.passwordSetUp) pendingPassword++;
    if (!data.phone) missingPhone++;
  });

  return {
    totalMigrated: snapshot.size,
    pendingPassword,
    missingPhone,
  };
}
