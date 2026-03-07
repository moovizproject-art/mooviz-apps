import { DeliveryStatus } from "../types/delivery";
import { UserRole } from "../types/user";

/**
 * Valid status transitions map.
 * Key = current status, Value = array of statuses it can transition to.
 */
export const STATUS_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  new: ["pending", "cancelled"],
  pending: ["waiting", "new", "cancelled"],
  waiting: ["picked_up", "cancelled"],
  picked_up: ["delivered"],
  delivered: ["completed_paid"],
  cancelled: [],
  completed_paid: [],
};

/**
 * Who can trigger each status transition.
 * Key format: "fromStatus -> toStatus"
 */
export const TRANSITION_ACTORS: Record<string, Array<UserRole | "system">> = {
  "new -> pending": ["driver"],
  "new -> cancelled": ["sender", "system"],
  "pending -> waiting": ["sender"],
  "pending -> new": ["sender", "driver"],
  "pending -> cancelled": ["sender", "driver", "system"],
  "waiting -> picked_up": ["driver"],
  "waiting -> cancelled": ["sender", "driver"],
  "picked_up -> delivered": ["driver"],
  "delivered -> completed_paid": ["sender", "driver", "system"],
};

export interface StatusDisplayConfig {
  labelHe: string;
  labelEn: string;
  color: string;
  icon: string;
}

/**
 * Display configuration for each delivery status.
 */
export const STATUS_DISPLAY: Record<DeliveryStatus, StatusDisplayConfig> = {
  new: {
    labelHe: "\u05D7\u05D3\u05E9",
    labelEn: "New",
    color: "#2196F3",
    icon: "fiber_new",
  },
  pending: {
    labelHe: "\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8",
    labelEn: "Pending Approval",
    color: "#FF9800",
    icon: "hourglass_empty",
  },
  waiting: {
    labelHe: "\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E1\u05D5\u05E3",
    labelEn: "Waiting for Pickup",
    color: "#9C27B0",
    icon: "schedule",
  },
  picked_up: {
    labelHe: "\u05E0\u05D0\u05E1\u05E3",
    labelEn: "Picked Up",
    color: "#00BCD4",
    icon: "local_shipping",
  },
  delivered: {
    labelHe: "\u05E0\u05DE\u05E1\u05E8",
    labelEn: "Delivered",
    color: "#8BC34A",
    icon: "check_circle",
  },
  cancelled: {
    labelHe: "\u05D1\u05D5\u05D8\u05DC",
    labelEn: "Cancelled",
    color: "#F44336",
    icon: "cancel",
  },
  completed_paid: {
    labelHe: "\u05D4\u05D5\u05E9\u05DC\u05DD \u05D5\u05E9\u05D5\u05DC\u05DD",
    labelEn: "Completed & Paid",
    color: "#4CAF50",
    icon: "paid",
  },
};

/**
 * Terminal statuses that cannot transition further.
 */
export const TERMINAL_STATUSES: DeliveryStatus[] = ["cancelled", "completed_paid"];

/**
 * Statuses that are eligible for timeout cleanup.
 */
export const TIMEOUT_ELIGIBLE_STATUSES: DeliveryStatus[] = ["new", "pending"];

/**
 * Default timeout duration in hours for new deliveries.
 */
export const DEFAULT_TIMEOUT_HOURS = 24;
