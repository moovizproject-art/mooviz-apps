/**
 * Storage Service — שירות אחסון
 * Image upload/download from Firebase Cloud Storage.
 * העלאה/הורדה של תמונות מ-Firebase Cloud Storage
 */

import storage from '@react-native-firebase/storage';

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
 * Upload a profile photo (encrypted).
 * Uses the encryption service for server-side AES-256 encryption.
 * העלאת תמונת פרופיל (מוצפנת)
 */
export { uploadEncryptedProfilePhoto as uploadProfilePhoto } from './encryption';

/**
 * Upload multiple delivery media files (images + video).
 * העלאת מדיה מרובה למשלוח (תמונות + וידאו)
 *
 * @param deliveryId - Delivery or sender ID for storage path
 * @param localUris - Array of local file URIs
 * @returns Array of download URLs
 */
export async function uploadDeliveryMedia(
  deliveryId: string,
  localUris: string[],
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const uri = localUris[i];
    const lower = uri.toLowerCase();
    const isVideo = lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.includes('video');
    const ext = isVideo ? 'mp4' : 'jpg';
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
    const path = `deliveries/${deliveryId}/media_${Date.now()}_${i}.${ext}`;
    const ref = storage().ref(path);
    await ref.putFile(uri, {
      contentType,
      customMetadata: { uploadedAt: new Date().toISOString() },
    });
    urls.push(await ref.getDownloadURL());
  }
  return urls;
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
  const path = `deliveries/${deliveryId}/proof/${type}_${timestamp}.jpg`;
  return uploadImage(localUri, path);
}

/**
 * Upload a payment proof screenshot.
 * העלאת צילום מסך הוכחת תשלום
 */
export async function uploadPaymentProof(
  deliveryId: string,
  localUri: string,
): Promise<string> {
  const timestamp = Date.now();
  const path = `deliveries/${deliveryId}/proof/payment_${timestamp}.jpg`;
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
