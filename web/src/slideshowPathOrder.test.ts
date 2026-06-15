import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSlideshowStartIndex,
  sortPathsByListingOrder,
} from "./slideshowPathOrder";

test("sortPathsByListingOrder sorts selected paths by listing order", () => {
  const listing = ["/a.png", "/b.txt", "/c.png", "/d.png"];
  assert.deepEqual(
    sortPathsByListingOrder(["/d.png", "/a.png", "/c.png"], listing),
    ["/a.png", "/c.png", "/d.png"],
  );
});

test("resolveSlideshowStartIndex defaults to first slide", () => {
  const paths = ["/a.png", "/b.png"];
  assert.equal(resolveSlideshowStartIndex(paths, "/b.png", false), 0);
  assert.equal(resolveSlideshowStartIndex(paths, null, true), 0);
});

test("resolveSlideshowStartIndex uses active item when enabled", () => {
  const paths = ["/a.png", "/b.png", "/c.png"];
  assert.equal(resolveSlideshowStartIndex(paths, "/b.png", true), 1);
  assert.equal(resolveSlideshowStartIndex(paths, "/missing.png", true), 0);
});
