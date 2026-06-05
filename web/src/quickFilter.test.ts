import assert from "node:assert/strict";
import test from "node:test";

import {
  entryMatchesQuickFilter,
  filterEntriesByQuickFilter,
  normalizeQuickFilterQuery,
} from "./quickFilter";

test("normalizeQuickFilterQuery trims whitespace", () => {
  assert.equal(normalizeQuickFilterQuery("  doc  "), "doc");
  assert.equal(normalizeQuickFilterQuery("   "), "");
});

test("default match is case-insensitive substring", () => {
  assert.equal(entryMatchesQuickFilter("Document.pdf", "doc"), true);
  assert.equal(entryMatchesQuickFilter("Document.pdf", "DOC"), true);
  assert.equal(entryMatchesQuickFilter("notes.txt", "doc"), false);
});

test("caseSensitive requires exact casing", () => {
  assert.equal(
    entryMatchesQuickFilter("Document.pdf", "doc", {
      caseSensitive: true,
      wholeWord: false,
      useRegex: false,
    }),
    false,
  );
  assert.equal(
    entryMatchesQuickFilter("Document.pdf", "Doc", {
      caseSensitive: true,
      wholeWord: false,
      useRegex: false,
    }),
    true,
  );
});

test("wholeWord requires full name match", () => {
  assert.equal(
    entryMatchesQuickFilter("Document.pdf", "doc", {
      caseSensitive: false,
      wholeWord: true,
      useRegex: false,
    }),
    false,
  );
  assert.equal(
    entryMatchesQuickFilter("doc", "doc", {
      caseSensitive: false,
      wholeWord: true,
      useRegex: false,
    }),
    true,
  );
});

test("useRegex supports patterns and invalid regex matches nothing", () => {
  assert.equal(
    entryMatchesQuickFilter("file-01.txt", "^file-\\d+", {
      caseSensitive: false,
      wholeWord: false,
      useRegex: true,
    }),
    true,
  );
  assert.equal(
    entryMatchesQuickFilter("file-01.txt", "[", {
      caseSensitive: false,
      wholeWord: false,
      useRegex: true,
    }),
    false,
  );
});

test("regex wholeWord anchors to full name", () => {
  assert.equal(
    entryMatchesQuickFilter("ab", "a", {
      caseSensitive: false,
      wholeWord: true,
      useRegex: true,
    }),
    false,
  );
  assert.equal(
    entryMatchesQuickFilter("a", "a", {
      caseSensitive: false,
      wholeWord: true,
      useRegex: true,
    }),
    true,
  );
});

test("filterEntriesByQuickFilter returns all when query empty", () => {
  const entries = [{ name: "a.txt" }, { name: "b.txt" }];
  assert.deepEqual(filterEntriesByQuickFilter(entries, ""), entries);
  assert.deepEqual(filterEntriesByQuickFilter(entries, "  "), entries);
});

test("filterEntriesByQuickFilter filters by name", () => {
  const entries = [{ name: "alpha.txt" }, { name: "beta.txt" }];
  assert.deepEqual(filterEntriesByQuickFilter(entries, "alp"), [
    { name: "alpha.txt" },
  ]);
});
