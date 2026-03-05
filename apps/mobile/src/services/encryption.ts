/**
 * PII Encryption Service -- stub
 * Full AES-256-GCM encryption will be implemented via Cloud Functions callable.
 * For now, this handles the client-side interface.
 */

import { uploadImage, getDownloadUrl } from './storage';

/**
 * Encrypt and upload a file.
 * TODO: Implement client-side encryption with server-provided key.
 * For MVP, upload directly (server-side encryption handled by Cloud Functions).
 */
export async function encryptAndUpload(
  fileUri: string,
  storagePath: string,
  _userId: string,
): Promise<string> {
  return uploadImage(fileUri, storagePath);
}

/**
 * Download and decrypt a file.
 * TODO: Implement decryption.
 */
export async function downloadAndDecrypt(
  storagePath: string,
  _userId: string,
): Promise<string> {
  return getDownloadUrl(storagePath);
}
