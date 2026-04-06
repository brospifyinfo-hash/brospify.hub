"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import de from "@/lib/dictionaries/de.json";
import en from "@/lib/dictionaries/en.json";

type Dict = typeof de;
type Locale = "de" | "en";

const DICTIONARIES: Record<Locale, Dict> = { de, en };

interface I18nCtx {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nCtx>({
  locale: "de",
  t: de,
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de");

  // Read cookie on mount
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)locale=(\w+)/);
    if (match && (match[1] === "de" || match[1] === "en")) {
      setLocaleState(match[1] as Locale);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `locale=${l};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t: DICTIONARIES[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
