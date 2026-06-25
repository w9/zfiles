import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSlideshowStartIndex,
  resolveViewerPreviewPaths,
  sortPathsByListingOrder,
} from "./slideshowPathOrder";

test("resolveViewerPreviewPaths filters selected paths to non-directory files", () => {
  const listing = [
    { path: "/a.png", isDir: false },
    { path: "/b.txt", isDir: false },
    { path: "/c.mp4", isDir: false },
    { path: "/d.mp3", isDir: false },
  ];
  assert.deepEqual(
    resolveViewerPreviewPaths(["/b.txt", "/d.mp3", "/c.mp4", "/a.png"], listing),
    ["/a.png", "/b.txt", "/c.mp4", "/d.mp3"],
  );
});

test("resolveViewerPreviewPaths uses listing files when nothing is selected", () => {
  const listing = [
    { path: "/a.png", isDir: false },
    { path: "/b.zip", isDir: false },
    { path: "/dir", isDir: true },
    { path: "/c.webm", isDir: false },
    { path: "/d.flac", isDir: false },
  ];
  assert.deepEqual(resolveViewerPreviewPaths([], listing), [
    "/a.png",
    "/b.zip",
    "/c.webm",
    "/d.flac",
  ]);
});

test("resolveViewerPreviewPaths excludes directories from selection", () => {
  const listing = [
    { path: "/a.png", isDir: false },
    { path: "/subdir", isDir: true },
  ];
  assert.deepEqual(
    resolveViewerPreviewPaths(["/subdir", "/a.png"], listing),
    ["/a.png"],
  );
});

test("resolveViewerPreviewPaths includes all file types in listing", () => {
  const listing = [
    { path: "/a.png", isDir: false },
    { path: "/b.pdf", isDir: false },
    { path: "/c.txt", isDir: false },
    { path: "/d.md", isDir: false },
    { path: "/e.svg", isDir: false },
    { path: "/f.zip", isDir: false },
  ];
  assert.deepEqual(resolveViewerPreviewPaths([], listing), [
    "/a.png",
    "/b.pdf",
    "/c.txt",
    "/d.md",
    "/e.svg",
    "/f.zip",
  ]);
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

test("resolveSlideshowStartIndex honors explicit start path when requested", () => {
  const paths = ["/a.png", "/b.png", "/c.png"];
  assert.equal(resolveSlideshowStartIndex(paths, "/b.png", false, true), 1);
  assert.equal(resolveSlideshowStartIndex(paths, "/missing.png", false, true), 0);
});
