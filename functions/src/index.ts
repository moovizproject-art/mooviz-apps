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
  declineDriver,
  confirmPickup,
  confirmDelivery,
  confirmPayment,
  cancelDelivery,
} from "./callable/deliveryCallable";

export {
  createUser,
  updateProfile,
  updateFCMToken,
  removeFCMToken,
} from "./callable/userCallable";

export { reviewKYC } from "./callable/kycCallable";

export {
  uploadProfilePhoto,
  getAuthorizedPhoto,
  decryptDocument,
} from "./callable/encryptionCallable";

export { sendBulkEmail } from "./callable/emailCallable";

// ─── Scheduled Functions ────────────────────────────────────────────
export { timeoutCleanup } from "./scheduled/timeoutCleanup";
export { chatAutoClose } from "./scheduled/chatAutoClose";
