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
 * Accepts both HLD format (lat/lng) and mobile format (latitude/longitude).
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
  // city is optional — mobile doesn't always send it
  // Accept both lat/lng (HLD) and latitude/longitude (mobile)
  const lat = (gp.lat as number) ?? (gp.latitude as number);
  const lng = (gp.lng as number) ?? (gp.longitude as number);
  if (typeof lat !== "number" || lat < -90 || lat > 90) {
    errors.push(`${fieldName}.lat must be a valid latitude (-90 to 90)`);
  }
  if (typeof lng !== "number" || lng < -180 || lng > 180) {
    errors.push(`${fieldName}.lng must be a valid longitude (-180 to 180)`);
  }
  // geohash is optional for destination (mobile generates it only for pickup)

  return errors;
}

/**
 * Validate delivery creation data.
 * Accepts both HLD field names and mobile client field names.
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

  // Validate item — accept both { item: { description } } and { itemDescription }
  const hasItemObj = d.item && typeof d.item === "object";
  const hasItemFlat = typeof d.itemDescription === "string" && (d.itemDescription as string).length > 0;
  if (!hasItemObj && !hasItemFlat) {
    errors.push("item description is required");
  }

  // Validate price — accept both "price" and "suggestedPrice"
  const price = (typeof d.price === "number" ? d.price : null) ??
    (typeof d.suggestedPrice === "number" ? d.suggestedPrice : null);
  if (price === null || price <= 0) {
    errors.push("price must be a positive number");
  }

  // pickupDate / scheduledDate are optional — mobile uses scheduledDate or null for ASAP

  return { valid: errors.length === 0, errors };
}
