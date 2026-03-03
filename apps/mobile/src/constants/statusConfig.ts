/**
 * Status Configuration — תצורת סטטוסים
 * Display configuration for each DeliveryStatus (label, color, icon).
 * תצורת תצוגה לכל סטטוס משלוח (תווית, צבע, אייקון)
 */

import { COLORS } from './colors';

export type DeliveryStatus =
  | 'pending'
  | 'matched'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

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
 * תצורת תצוגה לכל סטטוס משלוח
 */
export const STATUS_CONFIG: Record<DeliveryStatus, StatusDisplayConfig> = {
  pending: {
    label: 'ממתין',          // Waiting
    color: COLORS.warning,
    bgColor: COLORS.warningBg,
    icon: '\u23F3',           // hourglass
    description: 'Waiting for driver',
  },
  matched: {
    label: 'נהג נמצא',       // Driver found
    color: COLORS.info,
    bgColor: COLORS.infoBg,
    icon: '\u{1F91D}',       // handshake
    description: 'Matched with driver',
  },
  picked_up: {
    label: 'נאסף',           // Picked up
    color: '#7C3AED',        // purple
    bgColor: '#EDE9FE',
    icon: '\u{1F4E6}',       // package
    description: 'Package picked up',
  },
  in_transit: {
    label: 'בדרך',           // In transit
    color: COLORS.primary,
    bgColor: COLORS.infoBg,
    icon: '\u{1F69A}',       // delivery truck
    description: 'In transit to destination',
  },
  delivered: {
    label: 'נמסר',           // Delivered
    color: COLORS.success,
    bgColor: COLORS.successBg,
    icon: '\u2705',           // check mark
    description: 'Successfully delivered',
  },
  cancelled: {
    label: 'בוטל',           // Cancelled
    color: COLORS.error,
    bgColor: COLORS.errorBg,
    icon: '\u274C',           // cross mark
    description: 'Delivery cancelled',
  },
};

/**
 * Get display config for a status string.
 * Returns pending config as fallback for unknown status.
 */
export function getStatusConfig(status: string): StatusDisplayConfig {
  return STATUS_CONFIG[status as DeliveryStatus] || STATUS_CONFIG.pending;
}

/**
 * Ordered list of statuses for timeline display.
 * רשימת סטטוסים מסודרת לתצוגת ציר זמן
 */
export const STATUS_TIMELINE_ORDER: DeliveryStatus[] = [
  'pending',
  'matched',
  'picked_up',
  'in_transit',
  'delivered',
];
