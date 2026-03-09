import { DeliveryStatus, DeliveryCreateData, GeoPoint } from "../types/delivery";
import { UserRole } from "../types/user";
import { STATUS_TRANSITIONS, TRANSITION_ACTORS } from "../constants/statuses";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate whether a status transition is allowed and whether the actor
 * has the required role to perform it.
 */
export function validateStatusTransition(
  currentStatus: DeliveryStatus,
  newStatus: DeliveryStatus,
  actorRole: UserRole | "system"
): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    return false;
  }

  const transitionKey = `${currentStatus} -> ${newStatus}`;
  const allowedActors = TRANSITION_ACTORS[transitionKey];
  if (!allowedActors) {
    return false;
  }

  return allowedActors.includes(actorRole);
}

/**
 * Validate a GeoPoint object has all required fields.
 */
function validateGeoPoint(point: unknown, fieldName: string): string[] {
  const errors: string[] = [];
  if (!point || typeof point !== "object") {
    errors.push(`${fieldName} is required and must be an object`);
    return errors;
  }

  const gp = point as Record<string, unknown>;

  if (!gp.address || typeof gp.address !== "string") {
    errors.push(`${fieldName}.address is required`);
  }
  if (!gp.city || typeof gp.city !== "string") {
    errors.push(`${fieldName}.city is required`);
  }
  if (typeof gp.lat !== "number" || gp.lat < -90 || gp.lat > 90) {
    errors.push(`${fieldName}.lat must be a valid latitude (-90 to 90)`);
  }
  if (typeof gp.lng !== "number" || gp.lng < -180 || gp.lng > 180) {
    errors.push(`${fieldName}.lng must be a valid longitude (-180 to 180)`);
  }
  if (!gp.geohash || typeof gp.geohash !== "string") {
    errors.push(`${fieldName}.geohash is required`);
  }

  return errors;
}

/**
 * Validate delivery creation data.
 */
export function validateDeliveryCreate(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Delivery data is required"] };
  }

  const d = data as Record<string, unknown>;

  // Validate pickup
  errors.push(...validateGeoPoint(d.pickup, "pickup"));

  // Validate destination
  errors.push(...validateGeoPoint(d.destination, "destination"));

  // Validate item
  if (!d.item || typeof d.item !== "object") {
    errors.push("item is required and must be an object");
  } else {
    const item = d.item as Record<string, unknown>;
    if (!item.description || typeof item.description !== "string") {
      errors.push("item.description is required");
    }
    if (!item.type || typeof item.type !== "string") {
      errors.push("item.type is required");
    }
    if (!item.size || typeof item.size !== "string") {
      errors.push("item.size is required");
    }
    if (!item.photoURL || typeof item.photoURL !== "string") {
      errors.push("item.photoURL is required");
    }
  }

  // Validate price
  if (typeof d.price !== "number" || d.price <= 0) {
    errors.push("price must be a positive number");
  }

  // Validate pickupDate
  if (d.pickupDate !== "asap" && !d.pickupDate) {
    errors.push("pickupDate is required (Timestamp or 'asap')");
  }

  return { valid: errors.length === 0, errors };
}
