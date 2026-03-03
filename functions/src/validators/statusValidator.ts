import { HttpsError } from "firebase-functions/v2/https";
import {
  DeliveryStatus,
  UserRole,
  validateStatusTransition,
  STATUS_TRANSITIONS,
  TRANSITION_ACTORS,
  TERMINAL_STATUSES,
} from "@mooviz/shared";

/**
 * Server-side validation for delivery status transitions.
 * Throws HttpsError if the transition is invalid.
 */
export function assertValidTransition(
  currentStatus: DeliveryStatus,
  newStatus: DeliveryStatus,
  actorRole: UserRole | "system",
  actorId: string
): void {
  // Check if current status is terminal
  if (TERMINAL_STATUSES.includes(currentStatus)) {
    throw new HttpsError(
      "failed-precondition",
      `Delivery is in terminal status '${currentStatus}' and cannot be updated`
    );
  }

  // Check if the transition itself is valid
  const allowedNextStatuses = STATUS_TRANSITIONS[currentStatus];
  if (!allowedNextStatuses || !allowedNextStatuses.includes(newStatus)) {
    throw new HttpsError(
      "failed-precondition",
      `Cannot transition from '${currentStatus}' to '${newStatus}'. ` +
        `Allowed transitions: ${allowedNextStatuses?.join(", ") ?? "none"}`
    );
  }

  // Check RBAC: does the actor's role allow this transition?
  const transitionKey = `${currentStatus} -> ${newStatus}`;
  const allowedActors = TRANSITION_ACTORS[transitionKey];
  if (!allowedActors || !allowedActors.includes(actorRole)) {
    throw new HttpsError(
      "permission-denied",
      `Role '${actorRole}' is not authorized to transition from '${currentStatus}' to '${newStatus}'`
    );
  }
}

/**
 * Validate that the caller is the sender of the delivery.
 */
export function assertIsSender(
  deliverySenderId: string,
  callerId: string
): void {
  if (deliverySenderId !== callerId) {
    throw new HttpsError(
      "permission-denied",
      "Only the sender of this delivery can perform this action"
    );
  }
}

/**
 * Validate that the caller is the assigned driver of the delivery.
 */
export function assertIsDriver(
  deliveryDriverId: string | undefined,
  callerId: string
): void {
  if (!deliveryDriverId || deliveryDriverId !== callerId) {
    throw new HttpsError(
      "permission-denied",
      "Only the assigned driver of this delivery can perform this action"
    );
  }
}

/**
 * Validate that a user has a specific role.
 */
export async function assertUserRole(
  db: FirebaseFirestore.Firestore,
  userId: string,
  expectedRole: UserRole
): Promise<void> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const userData = userDoc.data();
  if (userData?.role !== expectedRole) {
    throw new HttpsError(
      "permission-denied",
      `This action requires '${expectedRole}' role`
    );
  }

  if (userData?.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Your account is not active"
    );
  }

  if (userData?.kycStatus !== "approved") {
    throw new HttpsError(
      "permission-denied",
      "Your KYC verification must be approved to perform this action"
    );
  }
}
