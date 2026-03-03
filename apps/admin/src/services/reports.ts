import {
  collection,
  doc,
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

export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
export type ReportCategory = 'harassment' | 'fraud' | 'damage' | 'no_show' | 'other';
export type ModerationAction = 'warning' | 'suspend' | 'block' | 'none';

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  deliveryId: string | null;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  moderationAction: ModerationAction | null;
  moderatorNote: string | null;
  resolvedBy: string | null;
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
}

export interface ReportsQueryParams {
  status?: ReportStatus;
  category?: ReportCategory;
  pageSize?: number;
  lastDoc?: DocumentSnapshot;
}

const reportsRef = collection(db, 'reports');

export async function getReports(params: ReportsQueryParams = {}): Promise<{
  reports: Report[];
  lastDoc: DocumentSnapshot | null;
}> {
  const constraints = [];

  if (params.status) {
    constraints.push(where('status', '==', params.status));
  }
  if (params.category) {
    constraints.push(where('category', '==', params.category));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(params.pageSize ?? 20));

  if (params.lastDoc) {
    constraints.push(startAfter(params.lastDoc));
  }

  const q = query(reportsRef, ...constraints);
  const snapshot = await getDocs(q);

  const reports = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Report[];

  const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;

  return { reports, lastDoc };
}

export async function resolveReport(
  reportId: string,
  action: ModerationAction,
  note: string,
  resolvedByUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'resolved',
    moderationAction: action,
    moderatorNote: note,
    resolvedBy: resolvedByUid,
    resolvedAt: Timestamp.now(),
  });
}

export async function dismissReport(
  reportId: string,
  note: string,
  resolvedByUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'dismissed',
    moderationAction: 'none',
    moderatorNote: note,
    resolvedBy: resolvedByUid,
    resolvedAt: Timestamp.now(),
  });
}

export async function setReportInvestigating(reportId: string): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'investigating',
  });
}
