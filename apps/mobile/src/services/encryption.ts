/**
 * PII Encryption Service — שירות הצפנת מידע אישי
 *
 * Profile photos are encrypted server-side (AES-256-CBC) by Cloud Functions.
 * This service handles the client-side flow:
 *
 * Upload: client → Storage temp path → Cloud Function encrypts → encrypted file
 * Download: client → Cloud Function authorizes + decrypts → base64 data
 *
 * Authorization for photos:
 * - Owner: always sees own photo
 * - Matched driver: sees sender photo only after delivery status >= 'waiting'
 * - Before matching: silhouette (AvatarCircle initials)
 */

import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';

// Cache to avoid re-fetching photos on every render
const photoCache = new Map<string, { data: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Upload a profile photo with server-side encryption.
 *
 * 1. Uploads raw image to `users/{uid}/profile-temp.jpg`
 * 2. Calls `uploadProfilePhoto` Cloud Function
 * 3. Cloud Function encrypts and stores as `users/{uid}/profile.enc`
 * 4. Returns the encrypted storage path
 */
export async function uploadEncryptedProfilePhoto(
  userId: string,
  localUri: string,
): Promise<string> {
  // Step 1: Upload raw to temp path
  const tempPath = `users/${userId}/profile-temp.jpg`;
  const ref = storage().ref(tempPath);
  await ref.putFile(localUri, { contentType: 'image/jpeg' });

  // Step 2: Call Cloud Function to encrypt
  const result = await functions().httpsCallable('uploadProfilePhoto')({});

  // Step 3: Invalidate cache
  photoCache.delete(userId);

  return result.data.storagePath;
}

/**
 * Get an authorized profile photo for display.
 *
 * Returns a base64 data URI if authorized, null if not.
 * Uses in-memory cache to avoid repeated Cloud Function calls.
 *
 * @param targetUserId - The user whose photo to fetch
 * @returns base64 data URI string or null
 */
export async function getAuthorizedProfilePhoto(
  targetUserId: string,
): Promise<string | null> {
  // Check cache
  const cached = photoCache.get(targetUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const result = await functions().httpsCallable('getAuthorizedPhoto')({
      targetUserId,
    });

    const { authorized, photoData } = result.data as {
      authorized: boolean;
      photoData: string | null;
    };

    if (!authorized || !photoData) {
      photoCache.set(targetUserId, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    photoCache.set(targetUserId, { data: photoData, expiresAt: Date.now() + CACHE_TTL_MS });
    return photoData;
  } catch (error) {
    console.error(`[Encryption] Failed to get photo for ${targetUserId}:`, error);
    return null;
  }
}

/**
 * Clear the photo cache for a specific user or all users.
 */
export function clearPhotoCache(userId?: string): void {
  if (userId) {
    photoCache.delete(userId);
  } else {
    photoCache.clear();
  }
}
