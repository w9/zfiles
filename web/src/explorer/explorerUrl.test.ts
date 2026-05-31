import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPLORER_URL_PREFIX,
  explorerHrefForPath,
  explorerPathFromPathname,
  isExplorerPathname,
} from "./explorerUrl";

test("explorerHrefForPath maps root and nested paths under /f", () => {
  assert.equal(explorerHrefForPath(""), "/");
  assert.equal(explorerHrefForPath("docs"), `${EXPLORER_URL_PREFIX}/docs`);
  assert.equal(explorerHrefForPath("docs/readme"), `${EXPLORER_URL_PREFIX}/docs/readme`);
  assert.equal(
    explorerHrefForPath("f"),
    `${EXPLORER_URL_PREFIX}/f`,
  );
  assert.equal(
    explorerHrefForPath("f/docs"),
    `${EXPLORER_URL_PREFIX}/f/docs`,
  );
});

test("explorerHrefForPath encodes special characters per segment", () => {
  assert.equal(
    explorerHrefForPath("my folder/a#b"),
    `${EXPLORER_URL_PREFIX}/my%20folder/a%23b`,
  );
});

test("explorerPathFromPathname decodes /f paths and treats /f as root", () => {
  assert.equal(explorerPathFromPathname("/"), "");
  assert.equal(explorerPathFromPathname("/f"), "");
  assert.equal(explorerPathFromPathname("/f/"), "");
  assert.equal(explorerPathFromPathname("/f/docs"), "docs");
  assert.equal(explorerPathFromPathname("/f/f"), "f");
  assert.equal(explorerPathFromPathname("/f/f/docs"), "f/docs");
  assert.equal(explorerPathFromPathname("/f/my%20folder/a%23b"), "my folder/a#b");
});

test("explorerPathFromPathname ignores non-explorer pathnames", () => {
  assert.equal(explorerPathFromPathname("/settings"), "");
  assert.equal(explorerPathFromPathname("/api/list"), "");
  assert.equal(explorerPathFromPathname("/assets/index.js"), "");
  assert.equal(explorerPathFromPathname("/file-icons/file.svg"), "");
});

test("isExplorerPathname recognizes explorer routes only", () => {
  assert.equal(isExplorerPathname("/"), true);
  assert.equal(isExplorerPathname("/f"), true);
  assert.equal(isExplorerPathname("/f/docs"), true);
  assert.equal(isExplorerPathname("/settings"), false);
  assert.equal(isExplorerPathname("/assets/app.js"), false);
});

test("explorer path round-trips through URL encoding", () => {
  const paths = ["", "docs", "f", "f/nested", "photos/vacation.jpg", "unicode/文件"];
  for (const path of paths) {
    assert.equal(explorerPathFromPathname(explorerHrefForPath(path)), path);
  }
});
