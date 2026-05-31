import assert from "node:assert/strict";
import test from "node:test";

import type { FileEntry } from "@/backend/types";
import type { ListingEntry } from "@/listing-types";
import { compareFileEntries, compareListingEntries, sortFileEntries } from "./listingSort";

function file(name: string, is_dir: boolean): FileEntry {
  return { name, path: name, is_dir, size: 1 };
}

function listing(key: string, isDir: boolean): ListingEntry {
  return {
    key,
    name: key,
    path: key,
    isDir,
    onSelect: () => {},
    onActivate: () => {},
  };
}

test("sortFileEntries puts folders first by default", () => {
  const sorted = sortFileEntries(
    [file("beta.txt", false), file("alpha", true), file("alpha.txt", false)],
    "folders-first",
  );
  assert.deepEqual(
    sorted.map((entry) => entry.name),
    ["alpha", "alpha.txt", "beta.txt"],
  );
});

test("sortFileEntries mixes folders and files when configured", () => {
  const sorted = sortFileEntries(
    [file("beta", true), file("alpha.txt", false)],
    "mixed",
  );
  assert.deepEqual(
    sorted.map((entry) => entry.name),
    ["alpha.txt", "beta"],
  );
});

test("compareFileEntries sorts names case-insensitively within a group", () => {
  assert.equal(
    compareFileEntries(file("Beta", false), file("alpha", false), "mixed"),
    1,
  );
});

test("compareListingEntries sorts folders first when configured", () => {
  const folder = listing("docs", true);
  const file = listing("readme.md", false);
  assert.equal(
    compareListingEntries(folder, file, "folders-first", () => 0),
    -1,
  );
});
