import { firestore } from "firebase-admin";

export type AdminActionType =
  | "suspend_user"
  | "block_user"
  | "activate_user"
  | "approve_kyc"
  | "reject_kyc"
  | "cancel_delivery"
  | "resolve_report"
  | "dismiss_report"
  | "refund_delivery";

export interface AdminAction {
  id?: string;
  adminId: string;
  actionType: AdminActionType;
  targetUserId?: string;
  targetDeliveryId?: string;
  targetReportId?: string;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: firestore.Timestamp;
}

export interface AdminActionCreateData {
  actionType: AdminActionType;
  targetUserId?: string;
  targetDeliveryId?: string;
  targetReportId?: string;
  reason: string;
  metadata?: Record<string, unknown>;
}
