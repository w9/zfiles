import assert from "node:assert/strict";
import test from "node:test";

import { filterDotEntries, isDotEntryName, shouldDimDotEntry } from "./listingFilter";

test("isDotEntryName matches leading-dot names", () => {
  assert.equal(isDotEntryName(".git"), true);
  assert.equal(isDotEntryName(".hidden.txt"), true);
  assert.equal(isDotEntryName("normal.txt"), false);
});

test("shouldDimDotEntry excludes parent row", () => {
  assert.equal(shouldDimDotEntry("..", ".."), false);
  assert.equal(shouldDimDotEntry(".git", ".git"), true);
});

test("filterDotEntries hides dot names unless requested", () => {
  const entries = [
    { name: ".git" },
    { name: "src" },
    { name: ".env" },
  ];
  assert.deepEqual(
    filterDotEntries(entries, false).map((entry) => entry.name),
    ["src"],
  );
  assert.deepEqual(
    filterDotEntries(entries, true).map((entry) => entry.name),
    [".git", "src", ".env"],
  );
});
