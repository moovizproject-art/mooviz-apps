/**
 * Validators — ולידטורים
 * Input validation utilities for phone, email, and required fields.
 * כלי עיזר לולידציה של טלפון, אימייל ושדות חובה
 */

// ──────────────────────────────────────────────
// Phone validation
// ──────────────────────────────────────────────

/**
 * Validate phone number (E.164 format or Israeli local format).
 * ולידציה של מספר טלפון (פורמט E.164 או מקומי ישראלי)
 *
 * Accepts:
 *   +972501234567, 0501234567, 050-123-4567
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;

  const cleaned = phone.replace(/[\s\-()]/g, '');

  // E.164 format (international)
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (e164Regex.test(cleaned)) return true;

  // Israeli local format (10 digits starting with 0)
  const israeliRegex = /^0[2-9]\d{7,8}$/;
  if (israeliRegex.test(cleaned)) return true;

  return false;
}

// ──────────────────────────────────────────────
// Email validation
// ──────────────────────────────────────────────

/**
 * Validate email address.
 * ולידציה של כתובת אימייל
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  // Standard email regex — covers most valid emails
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

// ──────────────────────────────────────────────
// General validators
// ──────────────────────────────────────────────

/**
 * Validate that a field is not empty.
 * ולידציה ששדה אינו ריק
 */
export function validateRequired(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}

/**
 * Validate minimum length.
 * ולידציה של אורך מינימלי
 */
export function validateMinLength(value: string, minLength: number): boolean {
  return !!value && value.trim().length >= minLength;
}

/**
 * Validate maximum length.
 * ולידציה של אורך מקסימלי
 */
export function validateMaxLength(value: string, maxLength: number): boolean {
  return !!value && value.trim().length <= maxLength;
}

/**
 * Validate numeric value within range.
 * ולידציה של ערך מספרי בטווח
 */
export function validateNumericRange(
  value: number,
  min: number,
  max: number,
): boolean {
  return !isNaN(value) && value >= min && value <= max;
}

/**
 * Validate Israeli ID number (Teudat Zehut).
 * ולידציה של מספר תעודת זהות ישראלית
 *
 * Uses the Luhn-like algorithm for Israeli ID validation.
 */
export function validateIsraeliId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;

  const cleaned = id.replace(/\D/g, '');
  if (cleaned.length > 9) return false;

  // Pad to 9 digits
  const padded = cleaned.padStart(9, '0');

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(padded[i], 10) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Validate OTP code (6 digits).
 * ולידציה של קוד OTP (6 ספרות)
 */
export function validateOTP(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Validate delivery price (positive number, reasonable range).
 * ולידציה של מחיר משלוח
 */
export function validateDeliveryPrice(price: number): boolean {
  return !isNaN(price) && price >= 0 && price <= 10000;
}
