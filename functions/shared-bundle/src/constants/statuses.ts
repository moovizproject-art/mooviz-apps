import { DeliveryStatus } from "../types/delivery";
import { UserRole } from "../types/user";

/**
 * Valid status transitions map.
 * Key = current status, Value = array of statuses it can transition to.
 */
export const STATUS_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  new: ["pending", "awaiting_confirm", "cancelled"],
  pending: ["awaiting_confirm", "new", "cancelled"],
  awaiting_confirm: ["waiting_for_pickup", "pending", "cancelled"],
  waiting_for_pickup: ["picked_up", "cancelled"],
  picked_up: ["delivered"],
  delivered: ["awaiting_payment"],
  awaiting_payment: ["completed_paid"],
  completed_paid: [],
  cancelled: [],
};

/**
 * Who can trigger each status transition.
 * Key format: "fromStatus -> toStatus"
 */
export const TRANSITION_ACTORS: Record<string, Array<UserRole | "system">> = {
  "new -> pending": ["driver"],
  "new -> awaiting_confirm": ["sender"],
  "new -> cancelled": ["sender", "system"],
  "pending -> awaiting_confirm": ["sender"],
  "pending -> new": ["sender", "driver"],
  "pending -> cancelled": ["sender", "driver", "system"],
  "awaiting_confirm -> waiting_for_pickup": ["driver"],
  "awaiting_confirm -> pending": ["driver", "system"],
  "awaiting_confirm -> cancelled": ["sender"],
  "waiting_for_pickup -> picked_up": ["driver"],
  "waiting_for_pickup -> cancelled": ["sender", "driver"],
  "picked_up -> delivered": ["driver"],
  "delivered -> awaiting_payment": ["sender", "driver"],
  "awaiting_payment -> completed_paid": ["sender", "driver", "system"],
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
  awaiting_confirm: {
    labelHe: "ממתין לאישור נהג",
    labelEn: "Awaiting Driver Confirmation",
    color: "#FF6F00",
    icon: "hourglass_top",
  },
  waiting_for_pickup: {
    labelHe: "ממתין לאיסוף",
    labelEn: "Waiting for Pickup",
    color: "#7B1FA2",
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
  awaiting_payment: {
    labelHe: "ממתין לתשלום",
    labelEn: "Awaiting Payment",
    color: "#F57C00",
    icon: "payments",
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
export const TIMEOUT_ELIGIBLE_STATUSES: DeliveryStatus[] = [
  "new",
  "pending",
  "awaiting_confirm",
  "awaiting_payment",
];

/**
 * Default timeout duration in hours for new deliveries.
 */
export const DEFAULT_TIMEOUT_HOURS = 24;
