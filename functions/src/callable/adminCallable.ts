import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Logging } from "@google-cloud/logging";
import { logger } from "../utils/logger";

const db = admin.firestore();
const logging = new Logging();

// ─── Types ───────────────────────────────────────────────────────────────────

interface LogEntry {
  timestamp: string;
  severity: string;
  functionName: string;
  message: string;
  jsonPayload?: Record<string, unknown>;
}

interface SystemVersions {
  functions: {
    deployedAt: string | null;
    version: string | null;
    commit: string | null;
  };
  mobile: {
    ios: string | null;
    android: string | null;
    updatedAt: string | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = new Set([
  "tamir.konor@gmail.com",
  "tamir@kal.solutions",
  "admin@mooviz.co.il",
]);

async function assertAdmin(request: { auth?: { uid: string; token: Record<string, unknown> } }): Promise<void> {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Must be signed in");
  // Fast path: known admin email in JWT token
  const email = request.auth.token?.email as string | undefined;
  if (email && ADMIN_EMAILS.has(email)) return;
  // Fallback: Firestore adminUids list (for future additional admins)
  const configDoc = await db.collection("adminActions").doc("config").get();
  const adminUids: string[] = configDoc.exists ? (configDoc.data()?.adminUids ?? []) : [];
  if (!adminUids.includes(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Admin access required");
  }
}

/** Strip revision suffix (e.g. `createdelivery-6abc1def` → `createdelivery`). */
function stripRevisionSuffix(name: string): string {
  return name.replace(/-[a-z0-9]{8}$/, "");
}

// ─── getLogs ─────────────────────────────────────────────────────────────────

export const getLogs = onCall(async (request) => {
  await assertAdmin(request);

  const rawHours: unknown = request.data?.hours;
  const rawSeverity: unknown = request.data?.severity;
  const rawFunctionName: unknown = request.data?.functionName;
  const rawPageSize: unknown = request.data?.pageSize;

  // Clamp hours 1–72, default 72
  let hours = 72;
  if (typeof rawHours === "number" && Number.isFinite(rawHours)) {
    hours = Math.min(72, Math.max(1, Math.floor(rawHours)));
  }

  // Clamp pageSize 1–500, default 200
  let pageSize = 200;
  if (typeof rawPageSize === "number" && Number.isFinite(rawPageSize)) {
    pageSize = Math.min(500, Math.max(1, Math.floor(rawPageSize)));
  }

  const severity =
    typeof rawSeverity === "string" ? rawSeverity.toUpperCase() : "ALL";

  const validSeverities = ["ERROR", "WARNING", "INFO", "DEFAULT", "ALL"];
  if (!validSeverities.includes(severity)) {
    throw new HttpsError(
      "invalid-argument",
      `severity must be one of: ${validSeverities.join(", ")}`
    );
  }

  const functionName =
    typeof rawFunctionName === "string" && rawFunctionName.trim()
      ? rawFunctionName.trim().toLowerCase()
      : null;

  if (functionName !== null) {
    if (!/^[a-z0-9_-]{1,63}$/.test(functionName)) {
      throw new HttpsError("invalid-argument", "functionName must be lowercase alphanumeric, hyphens, or underscores (max 63 chars)");
    }
  }

  // Build filter
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const filterParts: string[] = [
    `resource.type="cloud_run_revision"`,
    `timestamp>="${since}"`,
  ];

  if (severity !== "ALL") {
    filterParts.push(`severity="${severity}"`);
  }

  if (functionName) {
    filterParts.push(
      `resource.labels.service_name=~"^${functionName}"`
    );
  }

  const filter = filterParts.join(" AND ");

  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new HttpsError("internal", "GCLOUD_PROJECT not set");
  }

  let rawEntries: unknown[];
  try {
    const [entries] = await logging.getEntries({
      filter,
      orderBy: "timestamp desc",
      pageSize,
      resourceNames: [`projects/${projectId}`],
    });
    rawEntries = entries as unknown[];
  } catch (err) {
    logger.error("getLogs: failed to fetch Cloud Logging entries", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new HttpsError("internal", "Failed to fetch logs");
  }

  const logEntries: LogEntry[] = rawEntries.map((rawEntry) => {
    const entry = rawEntry as Record<string, unknown>;
    const metadata = (entry as { metadata?: Record<string, unknown> })
      .metadata ?? {};

    // Timestamp
    const ts = (metadata as { timestamp?: unknown }).timestamp;
    let timestamp = "";
    if (typeof ts === "string") {
      timestamp = ts;
    } else if (ts instanceof Date) {
      timestamp = ts.toISOString();
    } else if (ts && typeof (ts as { toISOString?: () => string }).toISOString === "function") {
      timestamp = (ts as { toISOString: () => string }).toISOString();
    }

    // Severity
    const sev =
      typeof (metadata as { severity?: unknown }).severity === "string"
        ? String((metadata as { severity: string }).severity)
        : "DEFAULT";

    // Service name (function name)
    const resource = (metadata as { resource?: Record<string, unknown> })
      .resource ?? {};
    const labels = (resource as { labels?: Record<string, unknown> }).labels ?? {};
    const rawServiceName =
      typeof (labels as { service_name?: unknown }).service_name === "string"
        ? String((labels as { service_name: string }).service_name)
        : "";
    const functionNameResult = stripRevisionSuffix(rawServiceName);

    // Message — may be in textPayload or jsonPayload.message
    const textPayload = (entry as { data?: unknown }).data;
    let message = "";
    let jsonPayload: Record<string, unknown> | undefined;

    if (typeof textPayload === "string") {
      message = textPayload;
    } else if (textPayload && typeof textPayload === "object") {
      const payload = textPayload as Record<string, unknown>;
      message =
        typeof payload.message === "string"
          ? payload.message
          : JSON.stringify(payload);
      jsonPayload = payload;
    }

    const result: LogEntry = {
      timestamp,
      severity: sev,
      functionName: functionNameResult,
      message,
    };
    if (jsonPayload !== undefined) {
      result.jsonPayload = jsonPayload;
    }
    return result;
  });

  return { entries: logEntries };
});

// ─── getSystemVersions ────────────────────────────────────────────────────────

export const getSystemVersions = onCall(async (request) => {
  await assertAdmin(request);

  const doc = await db.collection("system").doc("versions").get();

  const nullResult: SystemVersions = {
    functions: { deployedAt: null, version: null, commit: null },
    mobile: { ios: null, android: null, updatedAt: null },
  };

  if (!doc.exists) {
    return nullResult;
  }

  const data = doc.data() ?? {};

  const fn = (data.functions as Record<string, unknown> | undefined) ?? {};
  const mob = (data.mobile as Record<string, unknown> | undefined) ?? {};

  const toStr = (v: unknown): string | null =>
    v instanceof admin.firestore.Timestamp
      ? v.toDate().toISOString()
      : typeof v === "string"
      ? v
      : null;

  const result: SystemVersions = {
    functions: {
      deployedAt: toStr(fn.deployedAt),
      version: toStr(fn.version),
      commit: toStr(fn.commit),
    },
    mobile: {
      ios: toStr(mob.ios),
      android: toStr(mob.android),
      updatedAt: toStr(mob.updatedAt),
    },
  };

  return result;
});

// ─── recordDeploy ─────────────────────────────────────────────────────────────

export const recordDeploy = onCall(async (request) => {
  await assertAdmin(request);

  const {
    functionsVersion,
    functionsCommit,
    mobileIos,
    mobileAndroid,
  }: {
    functionsVersion?: string;
    functionsCommit?: string;
    mobileIos?: string;
    mobileAndroid?: string;
  } = request.data ?? {};

  const MAX_LEN = 100;
  for (const [key, val] of Object.entries({ functionsVersion, functionsCommit, mobileIos, mobileAndroid })) {
    if (val !== undefined && val.trim().length > MAX_LEN) {
      throw new HttpsError("invalid-argument", `${key} exceeds maximum length of ${MAX_LEN} characters`);
    }
  }

  // Trim values; treat empty/whitespace-only as absent
  const fn = functionsVersion?.trim() || null;
  const fc = functionsCommit?.trim() || null;
  const mios = mobileIos?.trim() || null;
  const mand = mobileAndroid?.trim() || null;

  const hasFunctions = !!(fn || fc);
  const hasMobile = !!(mios || mand);

  if (!hasFunctions && !hasMobile) {
    throw new HttpsError(
      "invalid-argument",
      "At least one non-empty field must be provided (functionsVersion, functionsCommit, mobileIos, mobileAndroid)"
    );
  }

  // Use dot-notation keys so update() writes nested paths correctly.
  // set() with merge:true does NOT expand dot notation — it would create
  // literal field names like "functions.version" rather than nested objects.
  const update: Record<string, unknown> = {};

  if (hasFunctions) {
    if (fn) update["functions.version"] = fn;
    if (fc) update["functions.commit"] = fc;
    update["functions.deployedAt"] = admin.firestore.FieldValue.serverTimestamp();
  }

  if (hasMobile) {
    if (mios) update["mobile.ios"] = mios;
    if (mand) update["mobile.android"] = mand;
    update["mobile.updatedAt"] = admin.firestore.FieldValue.serverTimestamp();
  }

  const docRef = db.collection("system").doc("versions");
  try {
    await docRef.update(update);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("NOT_FOUND") || msg.includes("No document to update")) {
      // First-ever deploy — document doesn't exist yet. Convert dot-notation
      // keys to nested objects for the initial set().
      const initData: Record<string, unknown> = {};
      for (const [path, val] of Object.entries(update)) {
        const dot = path.indexOf(".");
        if (dot !== -1) {
          const top = path.slice(0, dot);
          const sub = path.slice(dot + 1);
          if (!initData[top]) initData[top] = {};
          (initData[top] as Record<string, unknown>)[sub] = val;
        } else {
          initData[path] = val;
        }
      }
      await docRef.set(initData);
    } else {
      throw err;
    }
  }

  logger.info("recordDeploy: system/versions updated", {
    hasFunctions,
    hasMobile,
    functionsVersion: functionsVersion ?? null,
    functionsCommit: functionsCommit ?? null,
    mobileIos: mobileIos ?? null,
    mobileAndroid: mobileAndroid ?? null,
  });

  return { ok: true };
});
