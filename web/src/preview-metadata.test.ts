import assert from "node:assert/strict";
import test from "node:test";

import {
  countDirectoryChildren,
  fileExtension,
  formatKindLabel,
  formatPreviewModified,
  resolveSymlinkTarget,
} from "./preview-metadata";

test("fileExtension returns lowercase extension including dot", () => {
  assert.equal(fileExtension("photo.JPG"), ".jpg");
  assert.equal(fileExtension("README"), null);
  assert.equal(fileExtension("archive.tar.gz"), ".gz");
});

test("formatKindLabel uses MIME and extension for files", () => {
  assert.equal(
    formatKindLabel({
      isDir: false,
      path: "photo.jpg",
      contentType: null,
      labels: { folder: "Folder", noExtension: "(no extension)" },
    }),
    "image/jpeg (.jpg)",
  );
  assert.equal(
    formatKindLabel({
      isDir: false,
      path: "data.bin",
      contentType: null,
      labels: { folder: "Folder", noExtension: "(no extension)" },
    }),
    "(.bin)",
  );
  assert.equal(
    formatKindLabel({
      isDir: false,
      path: "README",
      contentType: null,
      labels: { folder: "Folder", noExtension: "(no extension)" },
    }),
    "(no extension)",
  );
  assert.equal(
    formatKindLabel({
      isDir: true,
      path: "docs",
      contentType: null,
      labels: { folder: "Folder", noExtension: "(no extension)" },
    }),
    "Folder",
  );
  assert.equal(
    formatKindLabel({
      isDir: false,
      path: "photo.jpg",
      contentType: "image/jpeg",
      labels: { folder: "Folder", noExtension: "(no extension)" },
    }),
    "image/jpeg (.jpg)",
  );
});

test("formatPreviewModified respects modified-time format setting", () => {
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  assert.match(formatPreviewModified(oneHourAgo, "en", "relative"), /hour/);
  assert.match(formatPreviewModified(oneHourAgo, "en", "absolute"), /:/);
  assert.equal(formatPreviewModified(null, "en", "relative"), "—");
});

test("resolveSymlinkTarget resolves relative targets inside served root", () => {
  assert.deepEqual(resolveSymlinkTarget("docs/readme-link", "README.md"), {
    resolvedPath: "docs/README.md",
    inRoot: true,
  });
  assert.deepEqual(resolveSymlinkTarget("docs/readme-link", "../README.md"), {
    resolvedPath: "README.md",
    inRoot: true,
  });
});

test("resolveSymlinkTarget rejects absolute and escaping targets", () => {
  assert.deepEqual(resolveSymlinkTarget("docs/link", "/etc/passwd"), {
    resolvedPath: null,
    inRoot: false,
  });
  assert.deepEqual(resolveSymlinkTarget("a/b/link", "../../../outside"), {
    resolvedPath: null,
    inRoot: false,
  });
});

test("countDirectoryChildren splits files and folders", () => {
  assert.deepEqual(
    countDirectoryChildren([
      { path: "docs", is_dir: true },
      { path: "docs/a.md", is_dir: false },
      { path: "docs/sub", is_dir: true },
    ]),
    { files: 1, folders: 2 },
  );
});
