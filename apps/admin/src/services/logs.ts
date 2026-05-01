import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface LogEntry {
  timestamp: string;
  severity: string;
  functionName: string;
  message: string;
  jsonPayload?: Record<string, unknown>;
}

export interface SystemVersions {
  functions: { deployedAt: string | null; version: string | null; commit: string | null };
  mobile: { ios: string | null; android: string | null; updatedAt: string | null };
}

export interface GetLogsParams {
  hours?: number;
  severity?: string;
  functionName?: string;
  pageSize?: number;
}

export interface RecordDeployParams {
  functionsVersion?: string;
  functionsCommit?: string;
  mobileIos?: string;
  mobileAndroid?: string;
}

const getLogsCallable = httpsCallable<GetLogsParams, { entries: LogEntry[] }>(functions, 'getLogs');
const getSystemVersionsCallable = httpsCallable<void, SystemVersions>(functions, 'getSystemVersions');
const recordDeployCallable = httpsCallable<RecordDeployParams, { ok: boolean }>(functions, 'recordDeploy');

export async function fetchLogs(params: GetLogsParams): Promise<LogEntry[]> {
  const result = await getLogsCallable(params);
  return result.data.entries;
}

export async function fetchSystemVersions(): Promise<SystemVersions> {
  const result = await getSystemVersionsCallable();
  return result.data;
}

export async function recordDeploy(params: RecordDeployParams): Promise<void> {
  await recordDeployCallable(params);
}
