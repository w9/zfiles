import assert from "node:assert/strict";
import test from "node:test";

import { pathsInIndexRange } from "./listingSelection";

test("pathsInIndexRange includes every entry between anchor and target", () => {
  const entries = [{ path: "/a" }, { path: "/b" }, { path: "/c" }, { path: "/d" }];
  assert.deepEqual([...pathsInIndexRange(entries, 1, 3)].sort(), ["/b", "/c", "/d"]);
  assert.deepEqual([...pathsInIndexRange(entries, 3, 1)].sort(), ["/b", "/c", "/d"]);
});

test("pathsInIndexRange handles a single-row range", () => {
  const entries = [{ path: "/only" }];
  assert.deepEqual([...pathsInIndexRange(entries, 0, 0)], ["/only"]);
});
