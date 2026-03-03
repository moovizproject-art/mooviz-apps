import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// ─── Firestore Triggers ─────────────────────────────────────────────
export { onDeliveryCreate, onDeliveryUpdate } from "./triggers/deliveryTrigger";
export { onUserCreate, onUserUpdate } from "./triggers/userTrigger";
export { onMessageCreate } from "./triggers/chatTrigger";

// ─── Callable Functions ─────────────────────────────────────────────
export {
  expressInterest,
  approveDriver,
  confirmPickup,
  confirmDelivery,
  confirmPayment,
  cancelDelivery,
} from "./callable/deliveryCallable";

export {
  updateProfile,
  updateFCMToken,
} from "./callable/userCallable";

// ─── Scheduled Functions ────────────────────────────────────────────
export { timeoutCleanup } from "./scheduled/timeoutCleanup";
