"use client";
import { createContext, useCallback, useContext } from "react";
import { dictionaries, translate, type DictKey, type Lang } from "./dict";

const LangContext = createContext<Lang>("so");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const lang = useContext(LangContext);
  return useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => translate(dictionaries[lang], key, vars),
    [lang],
  );
}
