import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useI18n } from '../i18n/I18nContext';
import { fetchLogs, fetchSystemVersions, recordDeploy, type LogEntry } from '../services/logs';

const SEVERITY_OPTIONS = ['ALL', 'ERROR', 'WARNING', 'INFO'] as const;
type Severity = typeof SEVERITY_OPTIONS[number];

const SEVERITY_ROW_BG: Record<string, string> = {
  ERROR:   'bg-red-50',
  WARNING: 'bg-yellow-50/60',
  INFO:    '',
  DEFAULT: '',
};

const SEVERITY_BADGE: Record<string, string> = {
  ERROR:   'bg-red-100 text-red-800 border-red-200',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  INFO:    'bg-blue-100 text-blue-800 border-blue-200',
  DEFAULT: 'bg-gray-100 text-gray-700 border-gray-200',
};

const SEVERITY_BTN_ACTIVE: Record<Severity, string> = {
  ALL:     'bg-gray-700 text-white',
  ERROR:   'bg-red-600 text-white',
  WARNING: 'bg-yellow-500 text-white',
  INFO:    'bg-blue-600 text-white',
};

const KNOWN_FUNCTIONS = [
  'createDelivery','editDelivery','expressInterest','selectDriver',
  'confirmSelection','declineSelection','cancelSelectedDriver','confirmPickup',
  'confirmDelivery','confirmPayment','cancelDelivery','submitRating',
  'createUser','updateProfile','reviewKYC','timeoutCleanup',
  'notifyExpansion','selectionTimeout','chatAutoClose',
  'onDeliveryCreate','onDeliveryUpdate','onUserCreate','onUserUpdate',
  'onMessageCreate','onReportCreate','onReportUpdate',
  'getLogs','getSystemVersions','recordDeploy',
];

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_BADGE[severity] ?? SEVERITY_BADGE.DEFAULT;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {severity}
    </span>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ts = useMemo(() => {
    try { return format(new Date(entry.timestamp), 'dd/MM HH:mm:ss'); }
    catch { return entry.timestamp; }
  }, [entry.timestamp]);

  return (
    <div
      className={`border-b border-gray-100 px-4 py-2.5 hover:bg-gray-50 ${entry.jsonPayload ? 'cursor-pointer' : ''} ${SEVERITY_ROW_BG[entry.severity] ?? ''}`}
      onClick={() => entry.jsonPayload && setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3 text-sm">
        <span className="w-32 flex-shrink-0 font-mono text-xs text-gray-400">{ts}</span>
        <div className="w-20 flex-shrink-0"><SeverityBadge severity={entry.severity} /></div>
        <span className="w-40 flex-shrink-0 truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
          {entry.functionName}
        </span>
        <span className="flex-1 break-all text-gray-800">{entry.message}</span>
        {entry.jsonPayload && (
          <span className="flex-shrink-0 text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      {expanded && entry.jsonPayload && (
        <pre className="mt-2 ml-[14rem] overflow-x-auto rounded bg-gray-900 p-3 text-xs text-green-300">
          {JSON.stringify(entry.jsonPayload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function VersionPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    functionsVersion: '', functionsCommit: '', mobileIos: '', mobileAndroid: '',
  });

  const { data: versions } = useQuery({
    queryKey: ['systemVersions'],
    queryFn: fetchSystemVersions,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: recordDeploy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['systemVersions'] });
      setShowForm(false);
      setForm({ functionsVersion: '', functionsCommit: '', mobileIos: '', mobileAndroid: '' });
    },
  });

  const v = versions;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('logs.versions.title')}</h3>
        <button onClick={() => setShowForm((s) => !s)} className="text-xs text-blue-600 hover:underline">
          {t('logs.versions.record')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded bg-gray-50 p-2">
          <p className="mb-1 font-semibold text-gray-500">{t('logs.versions.functions')}</p>
          <p className="font-mono text-gray-800">{v?.functions.version ?? t('logs.versions.unknown')}</p>
          {v?.functions.commit && <p className="font-mono text-gray-500">{v.functions.commit}</p>}
          {v?.functions.deployedAt && (
            <p className="mt-1 text-gray-400">
              {t('logs.versions.deployedAt')}: {(() => {
                try { return format(new Date(v.functions.deployedAt!), 'dd/MM HH:mm'); }
                catch { return v.functions.deployedAt; }
              })()}
            </p>
          )}
        </div>
        <div className="rounded bg-gray-50 p-2">
          <p className="mb-1 font-semibold text-gray-500">{t('logs.versions.ios')}</p>
          <p className="font-mono text-gray-800">{v?.mobile.ios ?? t('logs.versions.unknown')}</p>
        </div>
        <div className="rounded bg-gray-50 p-2">
          <p className="mb-1 font-semibold text-gray-500">{t('logs.versions.android')}</p>
          <p className="font-mono text-gray-800">{v?.mobile.android ?? t('logs.versions.unknown')}</p>
        </div>
      </div>
      {showForm && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
          {([
            ['functionsVersion', 'Functions version (e.g. 1.0.8)'],
            ['functionsCommit', 'Commit (e.g. abc1234)'],
            ['mobileIos', 'iOS (e.g. 1.0.7 (148))'],
            ['mobileAndroid', 'Android (e.g. 1.0.7 (146))'],
          ] as [keyof typeof form, string][]).map(([key, placeholder]) => (
            <input
              key={key}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder={placeholder}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          ))}
          <button
            className="col-span-2 mt-1 rounded bg-blue-600 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? '...' : 'Save'}
          </button>
          {mutation.isError && (
            <p className="col-span-2 text-xs text-red-600">
              {mutation.error instanceof Error ? mutation.error.message : 'Error saving'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const { t } = useI18n();
  const [severity, setSeverity] = useState<Severity>('ALL');
  const [functionName, setFunctionName] = useState('');
  const [hours, setHours] = useState(72);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['logs', severity, functionName, hours],
    queryFn: () =>
      fetchLogs({
        hours,
        severity: severity === 'ALL' ? undefined : severity,
        functionName: functionName || undefined,
        pageSize: 400,
      }),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const entries = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        e.functionName.toLowerCase().includes(q) ||
        (e.jsonPayload && JSON.stringify(e.jsonPayload).toLowerCase().includes(q))
    );
  }, [data, search]);

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('logs.title')}</h1>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-gray-400">
              {t('logs.lastUpdated')}: {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
          >
            {isFetching ? '⟳' : t('logs.refresh')}
          </button>
        </div>
      </div>

      {/* Version panel */}
      <VersionPanel />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Severity toggles */}
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {SEVERITY_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`border-r border-gray-200 px-3 py-1.5 text-xs font-medium last:border-0 transition-colors ${
                severity === s ? SEVERITY_BTN_ACTIVE[s] : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`logs.severity.${s.toLowerCase()}`)}
            </button>
          ))}
        </div>

        {/* Function selector */}
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700"
          value={functionName}
          onChange={(e) => setFunctionName(e.target.value)}
        >
          <option value="">{t('logs.filter.function.all')}</option>
          {KNOWN_FUNCTIONS.map((fn) => (
            <option key={fn} value={fn}>{fn}</option>
          ))}
        </select>

        {/* Hours selector */}
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {[6, 12, 24, 48, 72].map((h) => (
            <option key={h} value={h}>{h}h</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
          placeholder={t('logs.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Count */}
        {!isLoading && data && (
          <span className="text-xs text-gray-400">
            {t('logs.count').replace('{{count}}', String(entries.length))}
          </span>
        )}
      </div>

      {/* Log feed */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-gray-400">{t('logs.loading')}</p>
        ) : isError ? (
          <p className="p-8 text-center text-sm text-red-500">
            {(error as Error)?.message ?? 'Failed to load logs'}
          </p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">{t('logs.empty')}</p>
        ) : (
          <div className="max-h-[calc(100vh-420px)] divide-y divide-gray-100 overflow-y-auto">
            {entries.map((entry) => (
              <LogRow key={`${entry.timestamp}-${entry.functionName}-${entry.message.slice(0, 30)}`} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
