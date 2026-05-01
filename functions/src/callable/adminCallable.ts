import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Logging } from "@google-cloud/logging";
import { logger } from "../utils/logger";

const db = admin.firestore();

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

async function assertAdmin(uid: string): Promise<void> {
  const userRecord = await admin.auth().getUser(uid);
  const isAdmin = userRecord.customClaims?.admin === true;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }
}

/** Strip revision suffix (e.g. `createdelivery-6abc1` → `createdelivery`). */
function stripRevisionSuffix(name: string): string {
  return name.replace(/-[a-z0-9]{5,}$/, "");
}

// ─── getLogs ─────────────────────────────────────────────────────────────────

export const getLogs = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  await assertAdmin(uid);

  const rawHours: unknown = request.data?.hours;
  const rawSeverity: unknown = request.data?.severity;
  const rawFunctionName: unknown = request.data?.functionName;
  const rawPageSize: unknown = request.data?.pageSize;

  // Clamp hours 1–72, default 72
  let hours = 72;
  if (typeof rawHours === "number") {
    hours = Math.min(72, Math.max(1, Math.floor(rawHours)));
  }

  // Clamp pageSize 1–500, default 200
  let pageSize = 200;
  if (typeof rawPageSize === "number") {
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

  const logging = new Logging();

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
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  await assertAdmin(uid);

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
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  await assertAdmin(uid);

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

  const hasFunctions =
    typeof functionsVersion === "string" || typeof functionsCommit === "string";
  const hasMobile =
    typeof mobileIos === "string" || typeof mobileAndroid === "string";

  if (!hasFunctions && !hasMobile) {
    throw new HttpsError(
      "invalid-argument",
      "At least one field must be provided (functionsVersion, functionsCommit, mobileIos, mobileAndroid)"
    );
  }

  const update: Record<string, unknown> = {};

  if (hasFunctions) {
    if (typeof functionsVersion === "string") {
      update["functions.version"] = functionsVersion;
    }
    if (typeof functionsCommit === "string") {
      update["functions.commit"] = functionsCommit;
    }
    update["functions.deployedAt"] = admin.firestore.FieldValue.serverTimestamp();
  }

  if (hasMobile) {
    if (typeof mobileIos === "string") {
      update["mobile.ios"] = mobileIos;
    }
    if (typeof mobileAndroid === "string") {
      update["mobile.android"] = mobileAndroid;
    }
    update["mobile.updatedAt"] = admin.firestore.FieldValue.serverTimestamp();
  }

  await db.collection("system").doc("versions").set(update, { merge: true });

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
