import { en, type MessageKey } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import { zhTW } from "./locales/zh-TW";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { it } from "./locales/it";
import { pt } from "./locales/pt";
import { ru } from "./locales/ru";
import { de } from "./locales/de";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { tr } from "./locales/tr";
import { id } from "./locales/id";
import { vi } from "./locales/vi";

export type { MessageKey };
export type Locale =
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "es"
  | "fr"
  | "it"
  | "pt"
  | "ru"
  | "de"
  | "ja"
  | "ko"
  | "tr"
  | "id"
  | "vi";

export const LOCALE_STORAGE_KEY = "zfiles-locale";
export const LOCALE_URL_PARAM = "lang";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  es,
  fr,
  it,
  pt,
  ru,
  de,
  ja,
  ko,
  tr,
  id,
  vi,
};

export const SUPPORTED_LOCALES: Locale[] = [
  "en",
  "zh-CN",
  "zh-TW",
  "es",
  "fr",
  "it",
  "pt",
  "ru",
  "de",
  "ja",
  "ko",
  "tr",
  "id",
  "vi",
];

export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) {
    return "en";
  }
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) {
    return "en";
  }

  // Chinese needs script/region disambiguation: Traditional vs Simplified.
  if (normalized === "zh" || normalized.startsWith("zh-")) {
    if (
      normalized.includes("tw") ||
      normalized.includes("hk") ||
      normalized.includes("mo") ||
      normalized.includes("hant")
    ) {
      return "zh-TW";
    }
    return "zh-CN";
  }

  const base = normalized.split("-")[0];
  const baseToLocale: Record<string, Locale> = {
    en: "en",
    es: "es",
    fr: "fr",
    it: "it",
    pt: "pt",
    ru: "ru",
    de: "de",
    ja: "ja",
    ko: "ko",
    tr: "tr",
    id: "id",
    vi: "vi",
  };
  return baseToLocale[base] ?? "en";
}

export function readLocaleFromUrl(search: string): Locale | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const value = params.get(LOCALE_URL_PARAM) ?? params.get("locale");
  if (!value) {
    return null;
  }
  return resolveLocale(value);
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }
  return resolveLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

export function readInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }
  const fromUrl = readLocaleFromUrl(window.location.search);
  if (fromUrl) {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return readStoredLocale();
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string>,
): string {
  let message = catalogs[locale][key] ?? catalogs.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.split(`{{${name}}}`).join(value);
    }
  }
  return message;
}

export function backendStatusMessage(
  locale: Locale,
  status: "connected" | "connecting" | "offline",
): string {
  switch (status) {
    case "connected":
      return translate(locale, "backend.connected");
    case "connecting":
      return translate(locale, "backend.connecting");
    case "offline":
      return translate(locale, "backend.offline");
  }
}
