import { useCallback } from 'react';
import { create } from 'zustand';

/**
 * Lightweight i18n.
 *
 * Dictionaries live in ./locales/<lang>/<area>.ts, each exporting a flat
 * `default` object of `'area.key': 'text'`. Files are merged automatically,
 * so adding an area never requires touching this file.
 *
 * Interpolation: `{name}` placeholders. Plurals: when `vars.count` is a number,
 * `key_one` / `key_other` are tried before `key` (Intl.PluralRules).
 */

export type Language = 'en' | 'tr';
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
];

type Dict = Record<string, string>;
type Vars = Record<string, string | number>;

function mergeModules(modules: Record<string, { default: Dict }>): Dict {
  return Object.values(modules).reduce<Dict>((acc, mod) => Object.assign(acc, mod.default), {});
}

const dictionaries: Record<Language, Dict> = {
  en: mergeModules(import.meta.glob<{ default: Dict }>('./locales/en/*.ts', { eager: true })),
  tr: mergeModules(import.meta.glob<{ default: Dict }>('./locales/tr/*.ts', { eager: true })),
};

const STORAGE_KEY = 'curio-language';

function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'tr') return stored;
  } catch {
    // storage unavailable — fall through to navigator
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr')) return 'tr';
  return 'en';
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: detectLanguage(),
  setLanguage: (language) => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore — preference just won't persist
    }
    if (typeof document !== 'undefined') document.documentElement.lang = language;
    set({ language });
  },
}));

if (typeof document !== 'undefined') document.documentElement.lang = useLanguageStore.getState().language;

export function getLanguage(): Language {
  return useLanguageStore.getState().language;
}

/** BCP-47 locale for Intl formatters. */
export function getLocale(language: Language = getLanguage()): string {
  return language === 'tr' ? 'tr-TR' : 'en-US';
}

function lookup(language: Language, key: string, vars?: Vars): string | undefined {
  const dict = dictionaries[language];
  if (vars && typeof vars.count === 'number') {
    const form = new Intl.PluralRules(getLocale(language)).select(vars.count);
    const plural = dict[`${key}_${form}`] ?? dict[`${key}_other`];
    if (plural !== undefined) return plural;
  }
  return dict[key];
}

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function translate(language: Language, key: string, vars?: Vars): string {
  const text = lookup(language, key, vars) ?? lookup('en', key, vars);
  if (text === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return interpolate(text, vars);
}

/** Non-React translate (stores, services, toasts) — uses the current language. */
export function t(key: string, vars?: Vars): string {
  return translate(getLanguage(), key, vars);
}

/** React hook: re-renders on language change. */
export function useT() {
  const language = useLanguageStore((state) => state.language);
  return useCallback((key: string, vars?: Vars) => translate(language, key, vars), [language]);
}
