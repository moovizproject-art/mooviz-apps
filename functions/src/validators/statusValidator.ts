import { HttpsError } from "firebase-functions/v2/https";
import {
  DeliveryStatus,
  UserRole,
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
 * Validate that a user has the required role.
 */
export async function assertUserRole(
  db: FirebaseFirestore.Firestore,
  userId: string,
  requiredRole: string
): Promise<FirebaseFirestore.DocumentData> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }
  const userData = userDoc.data()!;
  const role = userData.role ?? "sender";
  const activeMode = userData.activeMode ?? "client";

  // Admin users can perform any role action
  if (role === "admin") {
    return userData;
  }

  // activeMode 'client' maps to 'sender' role
  const effectiveRole = activeMode === "driver" ? "driver" : role;
  const isDualModeDriver =
    requiredRole === "driver" && userData.driverUnlocked === true && activeMode === "driver";

  if (effectiveRole !== requiredRole && !isDualModeDriver) {
    const roleNames: Record<string, string> = { driver: "נהג", sender: "שולח" };
    throw new HttpsError(
      "permission-denied",
      `פעולה זו דורשת תפקיד ${roleNames[requiredRole] || requiredRole}`
    );
  }

  return userData;
}

/**
 * Validate that a user exists and has an active account.
 */
export async function assertUserActive(
  db: FirebaseFirestore.Firestore,
  userId: string
): Promise<void> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const userData = userDoc.data();
  if (userData?.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "החשבון שלך אינו פעיל"
    );
  }
}

/**
 * Validate that a user exists, is active, and has approved KYC.
 * Required for driver actions (e.g., picking up, delivering).
 */
export async function assertDriverApproved(
  db: FirebaseFirestore.Firestore,
  userId: string
): Promise<void> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const userData = userDoc.data();
  if (userData?.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "החשבון שלך אינו פעיל"
    );
  }

  // Glide-migrated drivers have driverUnlocked but no KYC — grandfather them
  if (userData?.kycStatus !== "approved" && !userData?.driverUnlocked) {
    throw new HttpsError(
      "permission-denied",
      "יש לאשר את אימות הזהות (KYC) לפני ביצוע פעולה זו"
    );
  }
}
