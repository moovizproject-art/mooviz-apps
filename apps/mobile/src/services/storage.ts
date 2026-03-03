/**
 * Storage Service — שירות אחסון
 * Image upload/download from Firebase Cloud Storage.
 * העלאה/הורדה של תמונות מ-Firebase Cloud Storage
 */

import storage from '@react-native-firebase/storage';
import { IMAGE_MAX_SIZE } from '../constants/config';

// ──────────────────────────────────────────────
// Upload
// ──────────────────────────────────────────────

/**
 * Upload an image to Cloud Storage.
 * העלאת תמונה ל-Cloud Storage
 *
 * @param localUri - Local file URI (from image picker or camera)
 * @param storagePath - Path in Cloud Storage (e.g., "deliveries/abc123/photo.jpg")
 * @returns Download URL of the uploaded image
 */
export async function uploadImage(
  localUri: string,
  storagePath: string,
): Promise<string> {
  const reference = storage().ref(storagePath);

  // Upload the file
  const task = reference.putFile(localUri, {
    contentType: 'image/jpeg',
    customMetadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  // Monitor upload progress (optional logging)
  task.on('state_changed', (snapshot) => {
    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
    console.log(`[Storage] Upload progress: ${progress.toFixed(0)}%`);
  });

  await task;

  // Get the download URL
  const downloadUrl = await reference.getDownloadURL();
  return downloadUrl;
}

/**
 * Upload a profile photo.
 * העלאת תמונת פרופיל
 */
export async function uploadProfilePhoto(
  userId: string,
  localUri: string,
): Promise<string> {
  const path = `users/${userId}/profile.jpg`;
  return uploadImage(localUri, path);
}

/**
 * Upload a delivery item photo.
 * העלאת תמונת פריט למשלוח
 */
export async function uploadDeliveryPhoto(
  deliveryId: string,
  localUri: string,
): Promise<string> {
  const timestamp = Date.now();
  const path = `deliveries/${deliveryId}/item_${timestamp}.jpg`;
  return uploadImage(localUri, path);
}

/**
 * Upload a proof-of-delivery photo.
 * העלאת תמונת הוכחת מסירה
 */
export async function uploadProofPhoto(
  deliveryId: string,
  type: 'pickup' | 'delivery',
  localUri: string,
): Promise<string> {
  const timestamp = Date.now();
  const path = `deliveries/${deliveryId}/proof_${type}_${timestamp}.jpg`;
  return uploadImage(localUri, path);
}

/**
 * Upload a KYC document.
 * העלאת מסמך KYC
 */
export async function uploadKYCDocument(
  userId: string,
  localUri: string,
): Promise<string> {
  const timestamp = Date.now();
  const path = `kyc/${userId}/doc_${timestamp}.jpg`;
  return uploadImage(localUri, path);
}

// ──────────────────────────────────────────────
// Download / URL
// ──────────────────────────────────────────────

/**
 * Get download URL for a storage path.
 * קבלת URL להורדה עבור נתיב אחסון
 */
export async function getDownloadUrl(storagePath: string): Promise<string> {
  return storage().ref(storagePath).getDownloadURL();
}

// ──────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────

/**
 * Delete a file from Cloud Storage.
 * מחיקת קובץ מ-Cloud Storage
 */
export async function deleteFile(storagePath: string): Promise<void> {
  try {
    await storage().ref(storagePath).delete();
  } catch (error) {
    console.error(`[Storage] Failed to delete ${storagePath}:`, error);
    // Non-critical — log and continue
  }
}
