import assert from "node:assert/strict";
import test from "node:test";

import { resolveFileIconUrl } from "./fileIcons";

test("resolveFileIconUrl maps common extensions", () => {
  assert.match(resolveFileIconUrl({ name: "main.ts", isDir: false }), /typescript\.svg$/);
  assert.match(resolveFileIconUrl({ name: "lib.rs", isDir: false }), /rust\.svg$/);
  assert.match(resolveFileIconUrl({ name: "notes.md", isDir: false }), /markdown\.svg$/);
});

test("resolveFileIconUrl matches exact file names", () => {
  assert.match(resolveFileIconUrl({ name: "Dockerfile", isDir: false }), /docker\.svg$/);
  assert.match(resolveFileIconUrl({ name: "Makefile", isDir: false }), /makefile\.svg$/);
});

test("resolveFileIconUrl maps folder associations", () => {
  assert.match(resolveFileIconUrl({ name: "src", isDir: true }), /folder-src\.svg$/);
  assert.match(resolveFileIconUrl({ name: "misc", isDir: true }), /folder-other\.svg$/);
});

test("resolveFileIconUrl falls back to generic file and folder icons", () => {
  assert.match(resolveFileIconUrl({ name: "unknown.xyz123", isDir: false }), /file\.svg$/);
  assert.match(resolveFileIconUrl({ name: "random-dir", isDir: true }), /folder\.svg$/);
});

test("resolveFileIconUrl prefers compound extensions", () => {
  assert.match(resolveFileIconUrl({ name: "archive.tar.gz", isDir: false }), /\.svg$/);
});

test("resolveFileIconUrl applies light theme overrides when present", () => {
  const dark = resolveFileIconUrl({ name: "logo.blink", isDir: false, theme: "dark" });
  const light = resolveFileIconUrl({ name: "logo.blink", isDir: false, theme: "light" });
  assert.notEqual(dark, light);
  assert.match(light, /blink_light\.svg$/);
});
