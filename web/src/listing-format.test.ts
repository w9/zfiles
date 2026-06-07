import assert from "node:assert/strict";
import test from "node:test";

import {
  formatModifiedAbsolute,
  formatModifiedCombined,
  formatModifiedDisplay,
  formatRelativeModified,
  formatSize,
} from "./listing-format";

test("formatSize uses bytes below one kibibyte", () => {
  assert.equal(formatSize(512, false), "512 B");
  assert.equal(formatSize(0, false), "0 B");
});

test("formatSize uses human-readable binary units", () => {
  assert.equal(formatSize(1024, false), "1 KB");
  assert.equal(formatSize(1536, false), "1.5 KB");
  assert.equal(formatSize(5 * 1024 * 1024, false), "5 MB");
  assert.equal(formatSize(3 * 1024 * 1024 * 1024, false), "3 GB");
});

test("formatSize omits size for directories", () => {
  assert.equal(formatSize(undefined, true), "—");
  assert.equal(formatSize(100, true), "—");
});

test("formatRelativeModified returns em dash for invalid values", () => {
  assert.equal(formatRelativeModified(null, "en"), "—");
  assert.equal(formatRelativeModified("not-a-date", "en"), "—");
});

test("formatRelativeModified uses Intl.RelativeTimeFormat with locale", () => {
  const now = Date.parse("2025-05-29T12:00:00Z");
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const oneHourAgo = now - 3_600_000;
    assert.equal(formatRelativeModified(oneHourAgo, "en"), "1 hour ago");
    assert.equal(formatRelativeModified(oneHourAgo, "zh-CN"), "1小时前");
  } finally {
    Date.now = originalNow;
  }
});

test("formatRelativeModified treats very recent times as now", () => {
  const now = Date.parse("2025-05-29T12:00:00Z");
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    assert.equal(formatRelativeModified(now - 10_000, "en"), "now");
  } finally {
    Date.now = originalNow;
  }
});

test("formatModifiedAbsolute uses locale-specific datetime formatting", () => {
  const ms = Date.parse("2025-05-29T15:30:00Z");
  const en = formatModifiedAbsolute(ms, "en");
  const zh = formatModifiedAbsolute(ms, "zh-CN");
  assert.ok(en);
  assert.ok(zh);
  assert.notEqual(en, zh);
  assert.equal(formatModifiedAbsolute(null, "en"), null);
});

test("formatModifiedCombined shows absolute with relative in parentheses", () => {
  const now = Date.parse("2025-05-29T12:00:00Z");
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const oneHourAgo = now - 3_600_000;
    const combined = formatModifiedCombined(oneHourAgo, "en");
    assert.match(combined, /May/);
    assert.match(combined, /\(1 hour ago\)/);
  } finally {
    Date.now = originalNow;
  }
});

test("formatModifiedDisplay switches between relative and absolute formats", () => {
  const now = Date.parse("2025-05-29T12:00:00Z");
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const oneHourAgo = now - 3_600_000;
    const relative = formatModifiedDisplay(oneHourAgo, "en", "relative");
    assert.match(relative, /May/);
    assert.match(relative, /\(1 hour ago\)/);
    assert.match(formatModifiedDisplay(oneHourAgo, "en", "absolute"), /May/);
    assert.doesNotMatch(formatModifiedDisplay(oneHourAgo, "en", "absolute"), /hour ago/);
  } finally {
    Date.now = originalNow;
  }
});
