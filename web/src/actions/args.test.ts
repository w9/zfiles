import assert from "node:assert/strict";
import test from "node:test";

import { resolveActionArgs } from "./args";
import { defaultContextKeys } from "./contextKeys";

test("resolveActionArgs fills defaults from context", () => {
  const context = {
    ...defaultContextKeys(),
    "current-path": "docs",
    "selection.paths": ["a.txt", "b.txt"],
    "selection.count": 2,
  };
  const { resolved, missing } = resolveActionArgs(
    [{ name: "path", type: "string", default: { from: "current-path" } }],
    context,
  );
  assert.equal(resolved.path, "docs");
  assert.equal(missing.length, 0);
});

test("resolveActionArgs reports missing required args", () => {
  const { missing } = resolveActionArgs(
    [{ name: "path", type: "string" }],
    defaultContextKeys(),
  );
  assert.equal(missing.length, 1);
  assert.equal(missing[0]?.name, "path");
});
