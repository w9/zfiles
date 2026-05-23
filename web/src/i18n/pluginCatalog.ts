import type { Locale } from "./messages";

const pluginCatalogs: Record<Locale, Record<string, string>> = {
  en: {},
  "zh-CN": {},
};

export function mergePluginCatalog(
  locale: Locale,
  messages: Record<string, string>,
): void {
  pluginCatalogs[locale] = { ...pluginCatalogs[locale], ...messages };
}

export function clearPluginCatalogs(): void {
  pluginCatalogs.en = {};
  pluginCatalogs["zh-CN"] = {};
}

export function translatePlugin(locale: Locale, key: string): string | undefined {
  return pluginCatalogs[locale][key] ?? pluginCatalogs.en[key];
}

export async function loadPluginCatalogs(): Promise<void> {
  clearPluginCatalogs();
  const response = await fetch("/api/plugins/i18n");
  if (!response.ok) {
    return;
  }
  const data = (await response.json()) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  for (const locales of Object.values(data)) {
    for (const [locale, messages] of Object.entries(locales)) {
      if (locale === "en" || locale === "zh-CN") {
        mergePluginCatalog(locale, messages);
      }
    }
  }
}
