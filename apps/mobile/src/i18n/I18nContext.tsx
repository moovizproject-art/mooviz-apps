import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { strings, Locale } from './strings';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps): React.JSX.Element {
  const [locale, setLocale] = useState<Locale>('he');

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const parts = key.split('.');
      if (parts.length !== 2) return key;

      const [section, field] = parts;
      const sectionObj = (strings as Record<string, Record<string, { he: string; en: string }>>)[section];
      if (!sectionObj) return key;

      const entry = sectionObj[field];
      if (!entry) return key;

      let text = entry[locale] || entry.he;

      if (params) {
        for (const [param, value] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
        }
      }

      return text;
    },
    [locale],
  );

  return React.createElement(
    I18nContext.Provider,
    { value: { locale, setLocale, t } },
    children,
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
