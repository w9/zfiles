import { en, type MessageKey } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import { translatePlugin } from "./pluginCatalog";

export type { MessageKey };
export type Locale = "en" | "zh-CN";

export const LOCALE_STORAGE_KEY = "zfiles-locale";
export const LOCALE_URL_PARAM = "lang";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en,
  "zh-CN": zhCN,
};

export function resolveLocale(value: string | null | undefined): Locale {
  if (value === "zh-CN" || value === "zh") {
    return "zh-CN";
  }
  return "en";
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
  let message =
    translatePlugin(locale, key) ??
    catalogs[locale][key] ??
    catalogs.en[key] ??
    key;
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
