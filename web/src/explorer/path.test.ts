import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeExplorerPath } from "./path";

test("normalizeExplorerPath treats empty and slash-only as root", () => {
  assert.equal(normalizeExplorerPath(""), "");
  assert.equal(normalizeExplorerPath("   "), "");
  assert.equal(normalizeExplorerPath("/"), "");
  assert.equal(normalizeExplorerPath("///"), "");
});

test("normalizeExplorerPath trims and strips leading or trailing slashes", () => {
  assert.equal(normalizeExplorerPath("foo/bar"), "foo/bar");
  assert.equal(normalizeExplorerPath("/foo/bar/"), "foo/bar");
  assert.equal(normalizeExplorerPath("  nested/deep  "), "nested/deep");
});
