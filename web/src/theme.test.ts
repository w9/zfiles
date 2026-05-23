import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_THEME_MODE,
  nextThemeMode,
  parseThemeMode,
  resolvedTheme,
} from "./theme.ts";

describe("resolvedTheme", () => {
  it("returns explicit light and dark modes", () => {
    assert.equal(resolvedTheme("light", true), "light");
    assert.equal(resolvedTheme("dark", false), "dark");
  });

  it("follows system preference in auto mode", () => {
    assert.equal(resolvedTheme("auto", true), "dark");
    assert.equal(resolvedTheme("auto", false), "light");
  });
});

describe("parseThemeMode", () => {
  it("defaults invalid values to auto", () => {
    assert.equal(parseThemeMode(null), DEFAULT_THEME_MODE);
    assert.equal(parseThemeMode("invalid"), DEFAULT_THEME_MODE);
  });

  it("accepts known theme modes", () => {
    assert.equal(parseThemeMode("light"), "light");
    assert.equal(parseThemeMode("dark"), "dark");
    assert.equal(parseThemeMode("auto"), "auto");
  });
});

describe("nextThemeMode", () => {
  it("cycles light, dark, and auto", () => {
    assert.equal(nextThemeMode("light"), "dark");
    assert.equal(nextThemeMode("dark"), "auto");
    assert.equal(nextThemeMode("auto"), "light");
  });
});
