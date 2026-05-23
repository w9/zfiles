import assert from "node:assert/strict";
import test from "node:test";

import { formatSize, listingIconPrefix } from "./listing-format";

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

test("listingIconPrefix omits emoji when thumbnail is shown", () => {
  assert.equal(listingIconPrefix(false, "/api/thumbnail?path=photo.jpg"), "");
  assert.equal(listingIconPrefix(true, "/api/thumbnail?path=photo.jpg"), "");
});

test("listingIconPrefix shows folder or file emoji without thumbnail", () => {
  assert.equal(listingIconPrefix(true), "📁 ");
  assert.equal(listingIconPrefix(false), "📄 ");
});
