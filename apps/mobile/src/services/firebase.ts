/**
 * Firebase App Initialization
 * אתחול אפליקציית Firebase
 *
 * Firebase is initialized automatically by @react-native-firebase
 * when google-services.json (Android) and GoogleService-Info.plist (iOS)
 * are configured. This module provides a centralized check and exports.
 */

import firebase from '@react-native-firebase/app';
import type { ReactNativeFirebase } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import messaging from '@react-native-firebase/messaging';

// ──────────────────────────────────────────────
// Firestore settings
// ──────────────────────────────────────────────

// Enable offline persistence
firestore().settings({
  persistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
});

// ──────────────────────────────────────────────
// Initialization check
// ──────────────────────────────────────────────

export function isFirebaseInitialized(): boolean {
  return firebase.apps.length > 0;
}

export function getFirebaseApp(): ReactNativeFirebase.FirebaseApp {
  if (!isFirebaseInitialized()) {
    throw new Error(
      'Firebase not initialized. Ensure google-services.json / GoogleService-Info.plist are configured.',
    );
  }
  return firebase.app();
}

// ──────────────────────────────────────────────
// Service exports
// ──────────────────────────────────────────────

export const firebaseAuth = auth;
export const firebaseFirestore = firestore;
export const firebaseStorage = storage;
export const firebaseMessaging = messaging;

export default firebase;
