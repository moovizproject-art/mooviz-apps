import { UserCreateData } from "../types/user";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate E.164 phone number format.
 * E.164: + followed by 1-15 digits, e.g. +972501234567
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validate email format.
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate user creation data.
 */
export function validateUserCreate(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["User data is required"] };
  }

  const d = data as Record<string, unknown>;

  // fullName
  if (!d.fullName || typeof d.fullName !== "string") {
    errors.push("fullName is required");
  } else if (d.fullName.trim().length < 2) {
    errors.push("fullName must be at least 2 characters");
  } else if (d.fullName.trim().length > 100) {
    errors.push("fullName must be at most 100 characters");
  }

  // phone
  if (!d.phone || typeof d.phone !== "string") {
    errors.push("phone is required");
  } else if (!validatePhone(d.phone)) {
    errors.push("phone must be in E.164 format (e.g., +972501234567)");
  }

  // email (optional)
  if (d.email !== undefined && d.email !== null) {
    if (typeof d.email !== "string" || !validateEmail(d.email)) {
      errors.push("email must be a valid email address");
    }
  }

  // city
  if (!d.city || typeof d.city !== "string") {
    errors.push("city is required");
  }

  // role
  if (!d.role || (d.role !== "sender" && d.role !== "driver")) {
    errors.push("role must be 'sender' or 'driver'");
  }

  return { valid: errors.length === 0, errors };
}
