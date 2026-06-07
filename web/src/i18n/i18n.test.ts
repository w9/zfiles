import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  readInitialLocale,
  readLocaleFromUrl,
  resolveLocale,
  translate,
  type Locale,
} from "./messages";
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

test("resolveLocale defaults to English for unknown values", () => {
  assert.equal(resolveLocale("xx"), "en");
  assert.equal(resolveLocale(null), "en");
  assert.equal(resolveLocale(""), "en");
});

test("resolveLocale accepts supported locales", () => {
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("zh-CN"), "zh-CN");
  assert.equal(resolveLocale("zh"), "zh-CN");
  assert.equal(resolveLocale("zh-TW"), "zh-TW");
  assert.equal(resolveLocale("zh-Hant"), "zh-TW");
  assert.equal(resolveLocale("zh-HK"), "zh-TW");
  assert.equal(resolveLocale("es"), "es");
  assert.equal(resolveLocale("fr"), "fr");
  assert.equal(resolveLocale("it"), "it");
  assert.equal(resolveLocale("pt"), "pt");
  assert.equal(resolveLocale("ru"), "ru");
  assert.equal(resolveLocale("de"), "de");
  assert.equal(resolveLocale("ja"), "ja");
  assert.equal(resolveLocale("ko"), "ko");
  assert.equal(resolveLocale("tr"), "tr");
  assert.equal(resolveLocale("id"), "id");
  assert.equal(resolveLocale("vi"), "vi");
});

test("resolveLocale normalizes region subtags and casing", () => {
  assert.equal(resolveLocale("EN-US"), "en");
  assert.equal(resolveLocale("fr-FR"), "fr");
  assert.equal(resolveLocale("pt_BR"), "pt");
  assert.equal(resolveLocale("de-AT"), "de");
});

test("every supported locale catalog covers all message keys", () => {
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
  const keys = Object.keys(en) as MessageKey[];
  for (const locale of SUPPORTED_LOCALES) {
    const catalog = catalogs[locale];
    for (const key of keys) {
      assert.equal(
        typeof catalog[key],
        "string",
        `missing key ${key} for locale ${locale}`,
      );
      assert.ok(catalog[key].length > 0, `empty key ${key} for locale ${locale}`);
    }
  }
});

test("translate returns English strings", () => {
  assert.equal(translate("en", "app.title"), en["app.title"]);
  assert.equal(translate("en", "theme.light"), "Light");
});

test("translate returns Simplified Chinese strings", () => {
  assert.equal(translate("zh-CN", "app.title"), zhCN["app.title"]);
  assert.equal(translate("zh-CN", "theme.light"), "浅色");
});

test("translate returns strings for the added locales", () => {
  assert.equal(translate("fr", "theme.light"), fr["theme.light"]);
  assert.equal(translate("ja", "app.title"), "zfiles");
  assert.equal(translate("de", "actions.confirm.cancel"), "Abbrechen");
});

test("translate falls back to English for an empty catalog entry", () => {
  assert.equal(translate("vi", "app.title"), "zfiles");
});

test("translate interpolates placeholders", () => {
  assert.equal(
    translate("en", "selection.count", { count: "3" }),
    "3 selected",
  );
});

test("locale storage key is stable", () => {
  assert.equal(LOCALE_STORAGE_KEY, "zfiles-locale");
});

test("readLocaleFromUrl returns null when param absent", () => {
  assert.equal(readLocaleFromUrl(""), null);
});

test("readLocaleFromUrl resolves supported lang query values", () => {
  assert.equal(readLocaleFromUrl("?lang=zh-CN"), "zh-CN");
  assert.equal(readLocaleFromUrl("?lang=en"), "en");
  assert.equal(readLocaleFromUrl("?lang=zh"), "zh-CN");
});

test("readInitialLocale prefers URL param over stored locale", () => {
  const previous = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: () => "en",
      setItem: () => {},
    },
    location: { search: "?lang=zh-CN" },
  } as unknown as Window & typeof globalThis;
  try {
    assert.equal(readInitialLocale(), "zh-CN");
  } finally {
    globalThis.window = previous;
  }
});
