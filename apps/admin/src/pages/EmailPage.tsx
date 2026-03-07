import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { searchUsers, type AppUser } from '../services/users';
import { sendEmail } from '../services/email';

type RecipientMode = 'all' | 'selected' | 'single';

export default function EmailPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<RecipientMode>('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendPush, setSendPush] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (mode !== 'all' && search.length >= 2) {
      const timer = setTimeout(async () => {
        const found = await searchUsers(search);
        setUsers(found);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [search, mode]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectSingleUser = (id: string) => {
    setSelectedIds(new Set([id]));
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    const to = mode === 'all' ? 'all' : Array.from(selectedIds);
    if (mode !== 'all' && (to as string[]).length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await sendEmail({
        to,
        subject: subject.trim(),
        htmlBody: body.trim(),
        sendPush,
      });
      setResult({ type: 'success', message: res.message });
      setSubject('');
      setBody('');
      setSelectedIds(new Set());
    } catch (err: any) {
      setResult({
        type: 'error',
        message: err?.message || t('email.sendError'),
      });
    } finally {
      setLoading(false);
    }
  };

  const recipientCount = mode === 'all' ? t('email.allUsers') : `${selectedIds.size} ${t('email.selected')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('email.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('email.subtitle')}</p>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            result.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Recipient mode */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('email.recipients')}</h3>
        <div className="mt-4 flex gap-3">
          {(['all', 'selected', 'single'] as RecipientMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSelectedIds(new Set());
                setUsers([]);
                setSearch('');
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t(`email.mode_${m}`)}
            </button>
          ))}
        </div>

        {/* User search & selection */}
        {mode !== 'all' && (
          <div className="mt-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('email.searchPlaceholder')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {users.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-200">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 hover:bg-gray-50"
                    onClick={() =>
                      mode === 'single' ? selectSingleUser(user.id) : undefined
                    }
                  >
                    {mode === 'selected' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    )}
                    {mode === 'single' && (
                      <input
                        type="radio"
                        checked={selectedIds.has(user.id)}
                        onChange={() => selectSingleUser(user.id)}
                        className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    )}
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {user.fullName}
                      </p>
                      <p className="truncate text-xs text-gray-500">{user.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.size > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {selectedIds.size} {t('email.selected')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('email.compose')}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('email.subject')}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('email.body')}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={sendPush}
              onChange={(e) => setSendPush(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">{t('email.alsoSendPush')}</p>
              <p className="text-xs text-gray-500">{t('email.pushDesc')}</p>
            </div>
          </label>
        </div>
      </div>

      {/* Send */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {t('email.sendingTo')}: <span className="font-medium">{recipientCount}</span>
        </p>
        <button
          onClick={handleSend}
          disabled={loading || !subject.trim() || !body.trim() || (mode !== 'all' && selectedIds.size === 0)}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? t('email.sending') : t('email.send')}
        </button>
      </div>
    </div>
  );
}
