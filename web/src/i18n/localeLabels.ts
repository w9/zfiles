import type { MessageKey } from "./locales/en";
import type { Locale } from "./messages";

export const LOCALE_ARG_ACTION_ID = "appearance.set-locale";

export const LOCALE_LABEL_KEYS: Record<Locale, MessageKey> = {
  en: "language.en",
  "zh-CN": "language.zhCN",
  "zh-TW": "language.zhTW",
  es: "language.es",
  fr: "language.fr",
  it: "language.it",
  pt: "language.pt",
  ru: "language.ru",
  de: "language.de",
  ja: "language.ja",
  ko: "language.ko",
  tr: "language.tr",
  id: "language.id",
  vi: "language.vi",
};

export function isLocaleArgAction(actionId: string | null | undefined): boolean {
  return actionId === LOCALE_ARG_ACTION_ID;
}
