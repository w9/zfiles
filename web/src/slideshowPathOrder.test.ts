import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSlideshowStartIndex,
  resolveViewerImagePaths,
  sortPathsByListingOrder,
} from "./slideshowPathOrder";

test("resolveViewerImagePaths filters selected paths to images", () => {
  const listing = [
    { path: "/a.png", isDir: false },
    { path: "/b.txt", isDir: false },
    { path: "/c.png", isDir: false },
  ];
  assert.deepEqual(
    resolveViewerImagePaths(["/b.txt", "/c.png", "/a.png"], listing),
    ["/a.png", "/c.png"],
  );
});

test("resolveViewerImagePaths uses listing images when nothing is selected", () => {
  const listing = [
    { path: "/a.png", isDir: false },
    { path: "/b.txt", isDir: false },
    { path: "/dir", isDir: true },
    { path: "/c.png", isDir: false },
  ];
  assert.deepEqual(resolveViewerImagePaths([], listing), ["/a.png", "/c.png"]);
});

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
