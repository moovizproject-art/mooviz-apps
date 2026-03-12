/**
 * Status Configuration — תצורת סטטוסים
 * Display configuration for each DeliveryStatus (label, color, icon).
 * Canonical state machine: new → pending → waiting → picked_up → delivered → completed_paid | cancelled
 */

import { COLORS } from './colors';
import type { DeliveryStatus } from '../types';

interface StatusDisplayConfig {
  /** Hebrew label */
  label: string;
  /** Text/icon color */
  color: string;
  /** Badge background color */
  bgColor: string;
  /** Emoji/unicode icon */
  icon: string;
  /** English description (for logs/debug) */
  description: string;
}

/**
 * Status display config per delivery status.
 * Matches canonical 7-status state machine used by Cloud Functions and Firestore.
 */
export const STATUS_CONFIG: Record<DeliveryStatus, StatusDisplayConfig> = {
  new: {
    label: 'חדש',               // New
    color: COLORS.info,
    bgColor: COLORS.infoBg,
    icon: '\u2728',              // sparkles
    description: 'New listing',
  },
  pending: {
    label: 'ממתין לאישור',       // Pending approval
    color: COLORS.warning,
    bgColor: COLORS.warningBg,
    icon: '\u23F3',              // hourglass
    description: 'Waiting for sender approval',
  },
  waiting: {
    label: 'ממתין לאיסוף',       // Waiting for pickup
    color: '#7C3AED',           // purple
    bgColor: '#EDE9FE',
    icon: '\u{1F91D}',          // handshake
    description: 'Approved, waiting for driver pickup',
  },
  picked_up: {
    label: 'נאסף',              // Picked up
    color: COLORS.primary,
    bgColor: COLORS.infoBg,
    icon: '\u{1F4E6}',          // package
    description: 'Package picked up, in transit',
  },
  delivered: {
    label: 'נמסר',              // Delivered
    color: COLORS.success,
    bgColor: COLORS.successBg,
    icon: '\u2705',              // check mark
    description: 'Successfully delivered',
  },
  completed_paid: {
    label: 'הושלם ושולם',       // Completed & paid
    color: COLORS.success,
    bgColor: COLORS.successBg,
    icon: '\u{1F4B0}',          // money bag
    description: 'Completed and payment confirmed',
  },
  cancelled: {
    label: 'בוטל',              // Cancelled
    color: COLORS.error,
    bgColor: COLORS.errorBg,
    icon: '\u274C',              // cross mark
    description: 'Delivery cancelled',
  },
};

/**
 * Get display config for a status string.
 * Returns 'new' config as fallback for unknown status.
 */
export function getStatusConfig(status: string): StatusDisplayConfig {
  return STATUS_CONFIG[status as DeliveryStatus] || STATUS_CONFIG.new;
}

/**
 * Ordered list of statuses for timeline display (excludes cancelled).
 */
export const STATUS_TIMELINE_ORDER: DeliveryStatus[] = [
  'new',
  'pending',
  'waiting',
  'picked_up',
  'delivered',
  'completed_paid',
];

// Re-export the type for convenience
export type { DeliveryStatus };
