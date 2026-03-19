import { Timestamp } from "./timestamp";

export type ReportReason =
  | "inappropriate_behavior"
  | "fraud"
  | "damaged_item"
  | "no_show"
  | "harassment"
  | "other";

export type ReportStatus = "open" | "investigating" | "resolved" | "dismissed";

export interface Report {
  id?: string;
  deliveryId: string;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  description: string;
  evidenceURLs: string[];
  status: ReportStatus;
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReportCreateData {
  deliveryId: string;
  reportedUserId: string;
  reason: ReportReason;
  description: string;
  evidenceURLs?: string[];
}
