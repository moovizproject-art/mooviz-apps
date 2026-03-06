import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import en from './en';
import he from './he';

export type Locale = 'en' | 'he';

const strings: Record<Locale, Record<string, string>> = { en, he };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'mooviz-admin-locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === 'en' || saved === 'he') ? saved : 'he';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.dir = newLocale === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let value = strings[locale][key] ?? strings.en[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v);
      });
    }
    return value;
  }, [locale]);

  const dir = locale === 'he' ? 'rtl' : 'ltr';

  // Set initial dir
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
