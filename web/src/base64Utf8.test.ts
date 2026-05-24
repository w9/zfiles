import assert from "node:assert/strict";
import { test } from "node:test";

import { base64EncodeUtf8 } from "./base64Utf8";

function decodeBase64Utf8(encoded: string): string {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

test("base64EncodeUtf8 round-trips ASCII paths", () => {
  const path = "notes/subdir/report.txt";
  assert.equal(decodeBase64Utf8(base64EncodeUtf8(path)), path);
});

test("base64EncodeUtf8 round-trips Unicode paths and filenames", () => {
  const path = "文档/照片/截图 2026.png";
  assert.equal(decodeBase64Utf8(base64EncodeUtf8(path)), path);
});
