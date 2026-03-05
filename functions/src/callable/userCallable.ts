import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { UserUpdateData, validatePhone } from "@mooviz/shared";

const db = admin.firestore();

/**
 * Validate and update user profile.
 * Only allows updating specific fields.
 */
export const updateProfile = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const data = request.data as Partial<UserUpdateData>;

  // Check that user exists
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found");
  }

  // Build the update object with only allowed fields
  const update: Record<string, unknown> = {};

  if (data.fullName !== undefined) {
    if (typeof data.fullName !== "string" || data.fullName.trim().length < 2) {
      throw new HttpsError(
        "invalid-argument",
        "fullName must be at least 2 characters"
      );
    }
    if (data.fullName.trim().length > 100) {
      throw new HttpsError(
        "invalid-argument",
        "fullName must be at most 100 characters"
      );
    }
    update.fullName = data.fullName.trim();
  }

  if (data.email !== undefined) {
    if (data.email !== null && data.email !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new HttpsError("invalid-argument", "Invalid email format");
      }
    }
    update.email = data.email;
  }

  if (data.city !== undefined) {
    if (typeof data.city !== "string" || data.city.trim().length === 0) {
      throw new HttpsError("invalid-argument", "city cannot be empty");
    }
    update.city = data.city.trim();
  }

  if (data.profilePhotoURL !== undefined) {
    if (typeof data.profilePhotoURL !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "profilePhotoURL must be a string"
      );
    }
    update.profilePhotoURL = data.profilePhotoURL;
  }

  if (data.kycDocumentURL !== undefined) {
    if (typeof data.kycDocumentURL !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "kycDocumentURL must be a string"
      );
    }
    update.kycDocumentURL = data.kycDocumentURL;
    // Reset KYC status to pending when new document is uploaded
    update.kycStatus = "pending";
  }

  if (data.location !== undefined) {
    if (!data.location || typeof data.location !== "object") {
      throw new HttpsError("invalid-argument", "location must be an object");
    }
    if (
      typeof data.location.lat !== "number" ||
      data.location.lat < -90 ||
      data.location.lat > 90
    ) {
      throw new HttpsError(
        "invalid-argument",
        "location.lat must be a valid latitude"
      );
    }
    if (
      typeof data.location.lng !== "number" ||
      data.location.lng < -180 ||
      data.location.lng > 180
    ) {
      throw new HttpsError(
        "invalid-argument",
        "location.lng must be a valid longitude"
      );
    }
    if (
      !data.location.geohash ||
      typeof data.location.geohash !== "string"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "location.geohash is required"
      );
    }
    update.location = data.location;
  }

  if (Object.keys(update).length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "No valid fields provided for update"
    );
  }

  update.updatedAt = admin.firestore.Timestamp.now();

  await userRef.update(update);

  return { success: true, message: "Profile updated successfully" };
});

/**
 * Add an FCM token to the user's fcmTokens array for push notifications.
 * Uses arrayUnion to avoid duplicates.
 */
export const updateFCMToken = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { fcmToken } = request.data;

  if (!fcmToken || typeof fcmToken !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "fcmToken is required and must be a string"
    );
  }

  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found");
  }

  await userRef.update({
    fcmTokens: admin.firestore.FieldValue.arrayUnion(fcmToken),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  return { success: true, message: "FCM token added successfully" };
});

/**
 * Remove an FCM token from the user's fcmTokens array.
 * Used on logout or when a token becomes invalid.
 */
export const removeFCMToken = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { fcmToken } = request.data;

  if (!fcmToken || typeof fcmToken !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "fcmToken is required and must be a string"
    );
  }

  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found");
  }

  await userRef.update({
    fcmTokens: admin.firestore.FieldValue.arrayRemove(fcmToken),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  return { success: true, message: "FCM token removed successfully" };
});

/**
 * Create a new user profile document.
 * Called after Firebase Auth registration to set up the Firestore user doc.
 */
export const createUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { fullName, email, phone, city } = request.data;

  // Validate required fields
  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    throw new HttpsError("invalid-argument", "fullName must be at least 2 characters");
  }
  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "email is required");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new HttpsError("invalid-argument", "Invalid email format");
  }
  if (!phone || typeof phone !== "string") {
    throw new HttpsError("invalid-argument", "phone is required");
  }
  // E.164 format check
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new HttpsError("invalid-argument", "Phone must be in E.164 format (e.g., +972501234567)");
  }

  // Check if user doc already exists
  const existingDoc = await db.collection("users").doc(uid).get();
  if (existingDoc.exists) {
    throw new HttpsError("already-exists", "User profile already exists");
  }

  // Check for duplicate phone
  const phoneCheck = await db.collection("users").where("phone", "==", phone).limit(1).get();
  if (!phoneCheck.empty) {
    throw new HttpsError("already-exists", "Phone number already registered");
  }

  const now = admin.firestore.Timestamp.now();

  await db.collection("users").doc(uid).set({
    uid,
    fullName: fullName.trim(),
    email,
    phone,
    city: city || "",
    profilePhotoURL: "",
    kycDocumentURL: "",
    kycStatus: "pending",
    ratingAsDriver: { average: 0, count: 0 },
    ratingAsSender: { average: 0, count: 0 },
    completedDeliveries: 0,
    status: "active",
    fcmTokens: [],
    location: { lat: 0, lng: 0, geohash: "" },
    activeMode: "client",
    driverAvailable: false,
    driverUnlocked: false,
    createdAt: now,
    updatedAt: now,
  });

  return { success: true, message: "User profile created" };
});
