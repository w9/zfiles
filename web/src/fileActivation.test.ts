import assert from "node:assert/strict";
import test from "node:test";

import { resolveFileActivation } from "./fileActivation";

test("resolveFileActivation always opens preview for files", () => {
  assert.equal(resolveFileActivation("photo.png"), "preview");
  assert.equal(resolveFileActivation("archive.zip"), "preview");
  assert.equal(resolveFileActivation("binary.exe"), "preview");
  assert.equal(resolveFileActivation("noext"), "preview");
});
