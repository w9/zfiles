import assert from "node:assert/strict";
import { test } from "node:test";

import { sha256 } from "@noble/hashes/sha256";

import { base64EncodeBytes } from "./base64Utf8";
import { sha256Base64, sha256Base64Matches } from "./fileHash";

test("sha256Base64 matches noble digest for empty and text blobs", async () => {
  const empty = new Blob([]);
  assert.equal(await sha256Base64(empty), base64EncodeBytes(sha256("")));

  const text = new Blob(["hello"], { type: "text/plain" });
  assert.equal(
    await sha256Base64(text),
    base64EncodeBytes(sha256(new TextEncoder().encode("hello"))),
  );
});

test("sha256Base64Matches compares expected digest", async () => {
  const file = new File(["abc"], "a.txt");
  const digest = await sha256Base64(file);
  assert.equal(await sha256Base64Matches(file, digest), true);
  assert.equal(await sha256Base64Matches(file, "wrong"), false);
});
