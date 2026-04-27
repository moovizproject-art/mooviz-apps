/**
 * Status Configuration — תצורת סטטוסים
 * Display configuration for each DeliveryStatus (label, color, icon).
 * Canonical state machine: new → pending → awaiting_confirm → waiting_for_pickup → picked_up → delivered → awaiting_payment → completed_paid | cancelled
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
 * Matches canonical 9-status state machine used by Cloud Functions and Firestore.
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
    label: 'ממתין לבחירת נהג',   // Waiting for driver selection
    color: COLORS.warning,
    bgColor: COLORS.warningBg,
    icon: '\u23F3',              // hourglass
    description: 'Waiting for sender approval',
  },
  awaiting_confirm: {
    label: 'ממתין לאישור נהג',
    color: '#FF6F00',
    bgColor: '#FFF3E0',
    icon: '\u23F3',              // hourglass
    description: 'Sender selected driver, waiting for confirmation',
  },
  waiting_for_pickup: {
    label: 'ממתין לאיסוף',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    icon: '\u{1F91D}',          // handshake
    description: 'Driver confirmed, waiting for pickup',
  },
  picked_up: {
    label: 'נאסף',              // Picked up
    color: COLORS.primary,
    bgColor: COLORS.infoBg,
    icon: '\u{1F4E6}',          // package
    description: 'Package picked up, in transit',
  },
  delivered: {
    label: 'נמסר — ממתין לתשלום',  // Delivered, waiting for payment
    color: '#F57C00',
    bgColor: '#FFF3E0',
    icon: '\u{1F4B3}',              // credit card
    description: 'Delivered, waiting for payment',
  },
  awaiting_payment: {
    label: 'ממתין לאישור תשלום',  // Waiting for payment confirmation
    color: '#F57C00',
    bgColor: '#FFF3E0',
    icon: '\u{1F4B3}',          // credit card
    description: 'One party confirmed payment, waiting for other',
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
  'awaiting_confirm',
  'waiting_for_pickup',
  'picked_up',
  'delivered',
  'awaiting_payment',
  'completed_paid',
];

// Re-export the type for convenience
export type { DeliveryStatus };
