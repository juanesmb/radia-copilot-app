'use client';

import { createContext, useContext, useEffect, useTransition, useState, type ReactNode } from "react";
import { translations, type Language } from "@/lib/translations";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const STORAGE_KEY = "radia-language";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const detectBrowserLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "en";
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlLanguage = urlParams.get("language");
  if (urlLanguage === "en" || urlLanguage === "es") {
    return urlLanguage;
  }

  const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
  if (savedLanguage === "en" || savedLanguage === "es") {
    return savedLanguage;
  }

  const browserLanguage = navigator.language?.split("-")[0];
  return browserLanguage === "es" ? "es" : "en";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Always start with "en" to match server render and prevent hydration mismatch
  const [language, setLanguage] = useState<Language>("en");
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      const detected = detectBrowserLanguage();
      if (detected !== language) {
        setLanguage(detected);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAndPersistLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: string) => translations[language][key] ?? key;

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: setAndPersistLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export type { Language };

