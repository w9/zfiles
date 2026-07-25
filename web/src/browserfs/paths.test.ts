import assert from "node:assert/strict";
import test from "node:test";

import {
  descendantPrefix,
  isValidEntryName,
  joinPath,
  normalizePath,
  pathIsWithin,
  pathName,
  pathParent,
} from "./paths";

test("normalizePath trims slashes and collapses separators", () => {
  assert.equal(normalizePath(""), "");
  assert.equal(normalizePath("/"), "");
  assert.equal(normalizePath("///"), "");
  assert.equal(normalizePath("photos"), "photos");
  assert.equal(normalizePath("/photos/2024/"), "photos/2024");
  assert.equal(normalizePath("photos//2024"), "photos/2024");
});

test("pathParent and pathName split the last segment", () => {
  assert.equal(pathParent("photos/2024/a.jpg"), "photos/2024");
  assert.equal(pathParent("photos"), "");
  assert.equal(pathParent(""), "");
  assert.equal(pathName("photos/2024/a.jpg"), "a.jpg");
  assert.equal(pathName("photos"), "photos");
  assert.equal(pathName(""), "");
});

test("joinPath builds child paths from the root down", () => {
  assert.equal(joinPath("", "photos"), "photos");
  assert.equal(joinPath("photos", "2024"), "photos/2024");
  assert.equal(joinPath("/photos/", "a.jpg"), "photos/a.jpg");
});

test("pathIsWithin treats the root as an ancestor of everything", () => {
  assert.equal(pathIsWithin("photos", ""), true);
  assert.equal(pathIsWithin("", ""), true);
  assert.equal(pathIsWithin("photos/2024", "photos"), true);
  assert.equal(pathIsWithin("photos", "photos"), true);
  assert.equal(pathIsWithin("photoshop", "photos"), false);
  assert.equal(pathIsWithin("photos", "photos/2024"), false);
});

test("descendantPrefix bounds a subtree scan", () => {
  assert.equal(descendantPrefix("photos"), "photos/");
  assert.equal(descendantPrefix(""), "");
});

test("isValidEntryName rejects separators and relative segments", () => {
  assert.equal(isValidEntryName("a.jpg"), true);
  assert.equal(isValidEntryName("Ünïcode 名前"), true);
  assert.equal(isValidEntryName(""), false);
  assert.equal(isValidEntryName("   "), false);
  assert.equal(isValidEntryName("."), false);
  assert.equal(isValidEntryName(".."), false);
  assert.equal(isValidEntryName("a/b"), false);
  assert.equal(isValidEntryName("a\\b"), false);
  assert.equal(isValidEntryName("a\u0000b"), false);
});
