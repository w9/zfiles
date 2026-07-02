import assert from "node:assert/strict";
import { test } from "node:test";

import { buildContextMenuContextKeys } from "./contextMenuActions";
import { defaultContextKeys } from "./contextKeys";

test("buildContextMenuContextKeys sets selection for a single right-click target", () => {
  const keys = buildContextMenuContextKeys({
    baseContextKeys: defaultContextKeys(),
    targetPath: "/hello.txt",
    selectedPaths: new Set(["/hello.txt"]),
    listingRows: [{ path: "/hello.txt", isDir: false }],
  });

  assert.equal(keys["selection.count"], 1);
  assert.deepEqual(keys["selection.paths"], ["/hello.txt"]);
});

test("buildContextMenuContextKeys keeps multi-selection when target is included", () => {
  const keys = buildContextMenuContextKeys({
    baseContextKeys: defaultContextKeys(),
    targetPath: "/b.txt",
    selectedPaths: new Set(["/a.txt", "/b.txt"]),
    listingRows: [
      { path: "/a.txt", isDir: false },
      { path: "/b.txt", isDir: false },
    ],
  });

  assert.equal(keys["selection.count"], 2);
  assert.deepEqual(keys["selection.paths"], ["/a.txt", "/b.txt"]);
});

test("buildContextMenuContextKeys clears selection for listing background", () => {
  const keys = buildContextMenuContextKeys({
    baseContextKeys: {
      ...defaultContextKeys(),
      "selection.count": 2,
      "selection.paths": ["/a.txt", "/b.txt"],
    },
    targetPath: null,
    selectedPaths: new Set(),
    listingRows: [],
  });

  assert.equal(keys["selection.count"], 0);
  assert.deepEqual(keys["selection.paths"], []);
});
