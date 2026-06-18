import assert from "node:assert/strict";
import test from "node:test";

import {
  decodePreviewTextBytes,
  PREVIEW_TEXT_MAX_BYTES,
} from "./previewTextContent";

test("decodePreviewTextBytes decodes UTF-8 text", () => {
  const bytes = new TextEncoder().encode("hello\nworld");
  const result = decodePreviewTextBytes(bytes, PREVIEW_TEXT_MAX_BYTES);
  assert.equal(result.text, "hello\nworld");
  assert.equal(result.truncated, false);
});

test("decodePreviewTextBytes truncates when over maxBytes", () => {
  const bytes = new TextEncoder().encode("abcdef");
  const result = decodePreviewTextBytes(bytes, 3);
  assert.equal(result.text, "abc");
  assert.equal(result.truncated, true);
});

test("decodePreviewTextBytes handles partial UTF-8 at truncation boundary", () => {
  const bytes = new TextEncoder().encode("éclair");
  const result = decodePreviewTextBytes(bytes, 2);
  assert.equal(result.truncated, true);
  assert.ok(result.text.length > 0);
});
