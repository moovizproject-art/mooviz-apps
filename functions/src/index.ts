import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// ─── Firestore Triggers ─────────────────────────────────────────────
export { onDeliveryCreate, onDeliveryUpdate } from "./triggers/deliveryTrigger";
export { onUserCreate, onUserUpdate } from "./triggers/userTrigger";
export { onMessageCreate } from "./triggers/chatTrigger";
export { onReportCreate, onReportUpdate } from "./triggers/reportTrigger";

// ─── Callable Functions ─────────────────────────────────────────────
export {
  createDelivery,
  editDelivery,
  expressInterest,
  selectDriver,
  confirmSelection,
  declineSelection,
  cancelSelectedDriver,
  withdrawFromInterest,
  approveDriver,
  declineDriver,
  confirmPickup,
  confirmDelivery,
  confirmPayment,
  cancelDelivery,
  withdrawInterest,
  submitRating,
} from "./callable/deliveryCallable";

export {
  createUser,
  updateProfile,
  updateFCMToken,
  removeFCMToken,
  cleanupFCMTokens,
  deleteAccount,
} from "./callable/userCallable";

export { reviewKYC } from "./callable/kycCallable";

export {
  getLogs,
  getSystemVersions,
  recordDeploy,
} from "./callable/adminCallable";

export {
  uploadProfilePhoto,
  getAuthorizedPhoto,
  decryptDocument,
} from "./callable/encryptionCallable";

export { sendBulkEmail } from "./callable/emailCallable";

// purgeTestUsers removed — unauthenticated admin endpoint, security risk

// ─── Scheduled Functions ────────────────────────────────────────────
export { timeoutCleanup } from "./scheduled/timeoutCleanup";
export { chatAutoClose } from "./scheduled/chatAutoClose";
export { notifyExpansion } from "./scheduled/notifyExpansion";
export { selectionTimeout } from "./scheduled/selectionTimeout";
