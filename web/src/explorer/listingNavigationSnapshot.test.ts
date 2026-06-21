import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { captureListingNavigationSnapshot } from "./listingNavigationSnapshot";

describe("captureListingNavigationSnapshot", () => {
  it("copies entries so later mutations do not affect the snapshot", () => {
    const entries = [{ name: "a.txt", path: "a.txt", is_dir: false, size: 1, modified: 0 }];
    const snapshot = captureListingNavigationSnapshot({
      path: "/",
      entries,
      listCursor: "cursor-1",
      listingLoaded: true,
    });

    entries.push({
      name: "b.txt",
      path: "b.txt",
      is_dir: false,
      size: 2,
      modified: 0,
    });

    assert.equal(snapshot.entries.length, 1);
    assert.equal(snapshot.path, "/");
    assert.equal(snapshot.listCursor, "cursor-1");
    assert.equal(snapshot.listingLoaded, true);
  });
});
