import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

const db = admin.firestore();

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  collection: string;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  otp: { maxAttempts: 5, windowMs: 15 * 60 * 1000, collection: "rateLimits_otp" },
  login: { maxAttempts: 10, windowMs: 15 * 60 * 1000, collection: "rateLimits_login" },
};

export async function checkRateLimit(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS,
): Promise<void> {
  const config = RATE_LIMITS[limitType];
  if (!config) return;

  const docRef = db.collection(config.collection).doc(identifier);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const data = doc.data();

    if (data) {
      const windowStart = now - config.windowMs;
      const attempts = (data.attempts || []).filter(
        (ts: number) => ts > windowStart,
      );

      if (attempts.length >= config.maxAttempts) {
        throw new HttpsError(
          "resource-exhausted",
          `Too many attempts. Try again in ${Math.ceil(config.windowMs / 60000)} minutes.`,
        );
      }

      transaction.update(docRef, {
        attempts: [...attempts, now],
        updatedAt: admin.firestore.Timestamp.now(),
      });
    } else {
      transaction.set(docRef, {
        attempts: [now],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
  });
}
