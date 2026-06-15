import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultQuickFilterOptions,
  entryMatchesQuickFilter,
  filterEntriesByQuickFilter,
  firstQuickFilterMatchIndex,
  isPlainQuickFilterLetterKey,
  nextQuickFilterMatchIndex,
  normalizeQuickFilterQuery,
  QUICK_FILTER_OPTIONS_STORAGE_KEY,
  readStoredQuickFilterOptions,
  storeQuickFilterOptions,
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
      fadeUnmatched: false,
    }),
    false,
  );
  assert.equal(
    entryMatchesQuickFilter("Document.pdf", "Doc", {
      caseSensitive: true,
      wholeWord: false,
      useRegex: false,
      fadeUnmatched: false,
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
      fadeUnmatched: false,
    }),
    false,
  );
  assert.equal(
    entryMatchesQuickFilter("doc", "doc", {
      caseSensitive: false,
      wholeWord: true,
      useRegex: false,
      fadeUnmatched: false,
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
      fadeUnmatched: false,
    }),
    true,
  );
  assert.equal(
    entryMatchesQuickFilter("file-01.txt", "[", {
      caseSensitive: false,
      wholeWord: false,
      useRegex: true,
      fadeUnmatched: false,
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
      fadeUnmatched: false,
    }),
    false,
  );
  assert.equal(
    entryMatchesQuickFilter("a", "a", {
      caseSensitive: false,
      wholeWord: true,
      useRegex: true,
      fadeUnmatched: false,
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

test("default quick filter options hide unmatched entries", () => {
  assert.equal(defaultQuickFilterOptions.fadeUnmatched, false);
});

test("readStoredQuickFilterOptions ignores invalid stored values", () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: () =>
        JSON.stringify({
          caseSensitive: true,
          wholeWord: false,
          useRegex: "yes",
          fadeUnmatched: true,
        }),
      setItem: () => {},
    },
  } as unknown as Window & typeof globalThis;
  try {
    assert.deepEqual(readStoredQuickFilterOptions(), {
      caseSensitive: true,
      wholeWord: false,
      useRegex: false,
      fadeUnmatched: true,
    });
  } finally {
    globalThis.window = previousWindow;
  }
});

test("storeQuickFilterOptions persists all filter display toggles", () => {
  const previousWindow = globalThis.window;
  const storage = new Map<string, string>();
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  } as unknown as Window & typeof globalThis;
  try {
    storeQuickFilterOptions({
      caseSensitive: true,
      wholeWord: true,
      useRegex: false,
      fadeUnmatched: true,
    });
    assert.equal(
      storage.get(QUICK_FILTER_OPTIONS_STORAGE_KEY),
      JSON.stringify({
        caseSensitive: true,
        wholeWord: true,
        useRegex: false,
        fadeUnmatched: true,
      }),
    );
  } finally {
    globalThis.window = previousWindow;
  }
});

test("isPlainQuickFilterLetterKey accepts only unmodified letters", () => {
  assert.equal(
    isPlainQuickFilterLetterKey({
      key: "a",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    }),
    true,
  );
  assert.equal(
    isPlainQuickFilterLetterKey({
      key: "ArrowDown",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    }),
    false,
  );
  assert.equal(
    isPlainQuickFilterLetterKey({
      key: "j",
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    }),
    false,
  );
  assert.equal(
    isPlainQuickFilterLetterKey({
      key: "K",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: true,
    }),
    false,
  );
});

test("quick filter match navigation skips faded nonmatches", () => {
  const entries = [
    { quickFilterMatched: false },
    { quickFilterMatched: true },
    { quickFilterMatched: false },
    { quickFilterMatched: true },
  ];

  assert.equal(firstQuickFilterMatchIndex(entries), 1);
  assert.equal(nextQuickFilterMatchIndex(entries, 1, "down"), 3);
  assert.equal(nextQuickFilterMatchIndex(entries, 3, "down"), 3);
  assert.equal(nextQuickFilterMatchIndex(entries, 3, "up"), 1);
  assert.equal(nextQuickFilterMatchIndex(entries, 0, "down"), 1);
  assert.equal(nextQuickFilterMatchIndex(entries, 0, "up"), 3);
  assert.equal(
    nextQuickFilterMatchIndex([{ quickFilterMatched: false }], 0, "down"),
    -1,
  );
});
