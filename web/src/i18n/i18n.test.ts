import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCALE_STORAGE_KEY,
  readInitialLocale,
  readLocaleFromUrl,
  resolveLocale,
  translate,
} from "./messages";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

test("resolveLocale defaults to English for unknown values", () => {
  assert.equal(resolveLocale("fr"), "en");
  assert.equal(resolveLocale(null), "en");
});

test("resolveLocale accepts supported locales", () => {
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("zh-CN"), "zh-CN");
  assert.equal(resolveLocale("zh"), "zh-CN");
});

test("translate returns English strings", () => {
  assert.equal(translate("en", "app.title"), en["app.title"]);
  assert.equal(translate("en", "theme.light"), "Light");
});

test("translate returns Simplified Chinese strings", () => {
  assert.equal(translate("zh-CN", "app.title"), zhCN["app.title"]);
  assert.equal(translate("zh-CN", "theme.light"), "浅色");
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
