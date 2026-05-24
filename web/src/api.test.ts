import assert from "node:assert/strict";
import { test } from "node:test";

import { stripTokenFromUrl } from "./api";

test("stripTokenFromUrl removes token while preserving other query params", () => {
  const url = new URL("http://127.0.0.1:8080/?token=abc123&lang=zh-CN#preview");
  assert.equal(stripTokenFromUrl(url), "/?lang=zh-CN#preview");
});

test("stripTokenFromUrl is unchanged without token param", () => {
  const url = new URL("http://127.0.0.1:8080/?lang=en");
  assert.equal(stripTokenFromUrl(url), "/?lang=en");
});
