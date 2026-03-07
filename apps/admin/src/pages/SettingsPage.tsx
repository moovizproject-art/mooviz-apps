import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useI18n, type Locale } from '../i18n/I18nContext';

interface AppSettings {
  platformName: string;
  supportEmail: string;
  maxDeliveryDistance: number;
  baseFee: number;
  perKmFee: number;
  currency: string;
  kycRequired: boolean;
  autoMatchDrivers: boolean;
  notifications: {
    deliveryCreated: NotificationTemplate;
    deliveryAccepted: NotificationTemplate;
    deliveryPickedUp: NotificationTemplate;
    deliveryCompleted: NotificationTemplate;
    deliveryCancelled: NotificationTemplate;
  };
}

interface NotificationTemplate {
  title: string;
  body: string;
  title_he: string;
  body_he: string;
  enabled: boolean;
}

const defaultSettings: AppSettings = {
  platformName: 'MOOVIZ',
  supportEmail: 'support@mooviz.app',
  maxDeliveryDistance: 50,
  baseFee: 5.0,
  perKmFee: 1.5,
  currency: 'USD',
  kycRequired: true,
  autoMatchDrivers: false,
  notifications: {
    deliveryCreated: {
      title: 'New Delivery Request',
      body: 'A new delivery has been created near your area.',
      title_he: 'בקשת משלוח חדשה',
      body_he: 'משלוח חדש נוצר באזור שלך.',
      enabled: true,
    },
    deliveryAccepted: {
      title: 'Delivery Accepted',
      body: 'Your delivery has been accepted by a driver.',
      title_he: 'המשלוח אושר',
      body_he: 'המשלוח שלך התקבל על ידי נהג.',
      enabled: true,
    },
    deliveryPickedUp: {
      title: 'Package Picked Up',
      body: 'Your package has been picked up and is on its way.',
      title_he: 'החבילה נאספה',
      body_he: 'החבילה שלך נאספה והיא בדרך.',
      enabled: true,
    },
    deliveryCompleted: {
      title: 'Delivery Completed',
      body: 'Your delivery has been completed successfully.',
      title_he: 'המשלוח הושלם',
      body_he: 'המשלוח שלך הושלם בהצלחה.',
      enabled: true,
    },
    deliveryCancelled: {
      title: 'Delivery Cancelled',
      body: 'A delivery has been cancelled.',
      title_he: 'המשלוח בוטל',
      body_he: 'משלוח בוטל.',
      enabled: true,
    },
  },
};

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const docSnap = await getDoc(doc(db, 'config', 'app_settings'));
        if (docSnap.exists()) {
          setSettings({ ...defaultSettings, ...docSnap.data() } as AppSettings);
        }
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'config', 'app_settings'), settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function updateNotification(
    key: keyof AppSettings['notifications'],
    field: keyof NotificationTemplate,
    value: string | boolean,
  ) {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: { ...prev.notifications[key], [field]: value },
      },
    }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('settings.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">{t('settings.saved')}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('settings.language')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('settings.languageDesc')}</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setLocale('he')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              locale === 'he'
                ? 'bg-brand-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t('settings.hebrew')}
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              locale === 'en'
                ? 'bg-brand-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t('settings.english')}
          </button>
        </div>
      </div>

      {/* General Settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('settings.general')}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('settings.platformName')}</label>
            <input
              type="text"
              value={settings.platformName}
              onChange={(e) => setSettings((s) => ({ ...s, platformName: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('settings.supportEmail')}</label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('settings.currency')}</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="ILS">ILS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.maxDistance')}
            </label>
            <input
              type="number"
              value={settings.maxDeliveryDistance}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maxDeliveryDistance: Number(e.target.value) }))
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('settings.pricing')}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.baseFee')} ({settings.currency})
            </label>
            <input
              type="number"
              step="0.5"
              value={settings.baseFee}
              onChange={(e) => setSettings((s) => ({ ...s, baseFee: Number(e.target.value) }))}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.perKmFee')} ({settings.currency})
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.perKmFee}
              onChange={(e) => setSettings((s) => ({ ...s, perKmFee: Number(e.target.value) }))}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('settings.features')}</h3>
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.kycRequired}
              onChange={(e) => setSettings((s) => ({ ...s, kycRequired: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">{t('settings.kycRequired')}</p>
              <p className="text-xs text-gray-500">
                {t('settings.kycRequiredDesc')}
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoMatchDrivers}
              onChange={(e) =>
                setSettings((s) => ({ ...s, autoMatchDrivers: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">{t('settings.autoMatch')}</p>
              <p className="text-xs text-gray-500">
                {t('settings.autoMatchDesc')}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Notification Templates */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">{t('settings.notifications')}</h3>
        <div className="mt-4 space-y-6">
          {(
            Object.entries(settings.notifications) as [
              keyof AppSettings['notifications'],
              NotificationTemplate,
            ][]
          ).map(([key, template]) => (
            <div key={key} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                </h4>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.enabled}
                    onChange={(e) => updateNotification(key, 'enabled', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs text-gray-500">{t('settings.enabled')}</span>
                </label>
              </div>
              {/* English */}
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">English</p>
                <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">{t('settings.notifTitle')}</label>
                    <input
                      type="text"
                      value={template.title}
                      onChange={(e) => updateNotification(key, 'title', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">{t('settings.notifBody')}</label>
                    <input
                      type="text"
                      value={template.body}
                      onChange={(e) => updateNotification(key, 'body', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>
              {/* Hebrew */}
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">עברית</p>
                <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">{t('settings.notifTitle')}</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={template.title_he}
                      onChange={(e) => updateNotification(key, 'title_he', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">{t('settings.notifBody')}</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={template.body_he}
                      onChange={(e) => updateNotification(key, 'body_he', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
