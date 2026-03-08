/**
 * Formatters — פורמטרים
 * Date, currency, and distance formatting utilities.
 * כלי עיזר לעיצוב תאריך, מטבע ומרחק
 */

// ──────────────────────────────────────────────
// Date formatters
// ──────────────────────────────────────────────

/** Coerce Firestore Timestamps, strings, or Dates into a JS Date. */
function toDate(value: unknown): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (typeof value === 'string') return new Date(value);
  return new Date(NaN);
}

/**
 * Format a date for display (DD/MM/YYYY).
 * עיצוב תאריך לתצוגה
 */
export function formatDate(date: Date | string): string {
  const d = toDate(date);
  if (isNaN(d.getTime())) return '—';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format a date with time (DD/MM/YYYY HH:MM).
 * עיצוב תאריך עם שעה
 */
export function formatDateTime(date: Date | string): string {
  const d = toDate(date);
  if (isNaN(d.getTime())) return '—';

  const dateStr = formatDate(d);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * Format time only (HH:MM).
 * עיצוב שעה בלבד
 */
export function formatTime(date: Date | string): string {
  const d = toDate(date);
  if (isNaN(d.getTime())) return '—';

  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * Format relative date (e.g., "לפני 5 דקות", "אתמול").
 * עיצוב תאריך יחסי
 */
export function formatRelativeDate(date: Date | string): string {
  const d = toDate(date);
  if (isNaN(d.getTime())) return '—';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'עכשיו'; // Now
  if (diffMinutes < 60) return `לפני ${diffMinutes} דק׳`; // X minutes ago
  if (diffHours < 24) return `לפני ${diffHours} שע׳`; // X hours ago
  if (diffDays === 1) return 'אתמול'; // Yesterday
  if (diffDays < 7) return `לפני ${diffDays} ימים`; // X days ago
  return formatDate(d);
}

// ──────────────────────────────────────────────
// Currency formatters
// ──────────────────────────────────────────────

/**
 * Format amount as Israeli Shekel (₪).
 * עיצוב סכום בשקלים ישראליים
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '₪0';
  return `₪${amount.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format amount with decimals.
 * עיצוב סכום עם עשרוניות
 */
export function formatCurrencyDecimal(amount: number): string {
  if (isNaN(amount)) return '₪0.00';
  return `₪${amount.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ──────────────────────────────────────────────
// Distance formatters
// ──────────────────────────────────────────────

/**
 * Format distance in kilometers.
 * עיצוב מרחק בקילומטרים
 */
export function formatDistance(distanceKm: number): string {
  if (isNaN(distanceKm)) return '—';

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} מ׳`; // meters
  }

  return `${distanceKm.toFixed(1)} ק״מ`; // km
}

/**
 * Format a phone number for display.
 * עיצוב מספר טלפון לתצוגה
 */
export function formatPhoneNumber(phone: string): string {
  // +972501234567 -> 050-123-4567
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+972')) {
    const local = '0' + cleaned.substring(4);
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }

  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}
