import assert from "node:assert/strict";
import test from "node:test";

import {
  entryMatchesQuickFilter,
  filterEntriesByQuickFilter,
  firstQuickFilterMatchIndex,
  isQuickFilterTypeaheadKey,
  isValidQuickFilterRegex,
  nextQuickFilterMatchIndex,
  normalizeQuickFilterQuery,
  parseQuickFilterMode,
} from "./quickFilter";

test("normalizeQuickFilterQuery trims whitespace", () => {
  assert.equal(normalizeQuickFilterQuery("  doc  "), "doc");
  assert.equal(normalizeQuickFilterQuery("   "), "");
});

test("plain query is case-insensitive substring", () => {
  assert.equal(entryMatchesQuickFilter("Document.pdf", "doc"), true);
  assert.equal(entryMatchesQuickFilter("Document.pdf", "DOC"), true);
  assert.equal(entryMatchesQuickFilter("notes.txt", "doc"), false);
  assert.equal(entryMatchesQuickFilter("abc", "b"), true);
});

test("leading / starts case-sensitive regex (slash consumed)", () => {
  assert.equal(entryMatchesQuickFilter("file-01.txt", "/^file-"), true);
  assert.equal(entryMatchesQuickFilter("File-01.txt", "/^file-"), false);
  assert.equal(entryMatchesQuickFilter("file-01.txt", "/\\d+"), true);
  // invalid regex after / yields no match
  assert.equal(entryMatchesQuickFilter("file-01.txt", "/["), false);
});

test("regex closing delimiter ignores unescaped trailing slash", () => {
  assert.equal(entryMatchesQuickFilter("alpha.txt", "/alpha/"), true);
  assert.equal(entryMatchesQuickFilter("beta.txt", "/alpha/"), false);
  assert.equal(entryMatchesQuickFilter("path/to.txt", "/path\\/to/"), true);
  assert.equal(entryMatchesQuickFilter("pathXto.txt", "/path\\/to/"), false);
  assert.equal(entryMatchesQuickFilter("i.txt", "/i/"), true);
  assert.equal(entryMatchesQuickFilter("a.txt", "/i/"), false);
  assert.equal(entryMatchesQuickFilter("anything.txt", "//"), true);
});

test("/.../i suffix enables case-insensitive regex", () => {
  assert.equal(entryMatchesQuickFilter("File-01.txt", "/^file-/i"), true);
  assert.equal(entryMatchesQuickFilter("FILE-01.TXT", "/^file-\\d+/i"), true);
  // without leading /, /i is literal substring
  assert.equal(entryMatchesQuickFilter("foo/i", "foo/i"), true);
  assert.equal(entryMatchesQuickFilter("foo/i", "/foo/i"), true); // treated as regex "foo" + ci? wait: query="/foo/i" -> kind regex pattern="foo" ci
  assert.equal(entryMatchesQuickFilter("FOO", "/foo/i"), true);
});

test("plain text never treats trailing /i specially", () => {
  assert.equal(entryMatchesQuickFilter("abc/i", "abc/i"), true);
  assert.equal(entryMatchesQuickFilter("ABC/I", "abc/i"), true); // ci substr
});

test("regex mode supports user-provided anchors for whole-name match", () => {
  assert.equal(entryMatchesQuickFilter("ab", "/^a$"), false);
  assert.equal(entryMatchesQuickFilter("a", "/^a$"), true);
  assert.equal(entryMatchesQuickFilter("A", "/^a$/i"), true);
  assert.equal(entryMatchesQuickFilter("abc", "/^ab"), true);
});

test("filterEntriesByQuickFilter returns all when query empty", () => {
  const entries = [{ name: "a.txt" }, { name: "b.txt" }];
  assert.deepEqual(filterEntriesByQuickFilter(entries, ""), entries);
  assert.deepEqual(filterEntriesByQuickFilter(entries, "  "), entries);
});

test("filterEntriesByQuickFilter filters by name (plain)", () => {
  const entries = [{ name: "alpha.txt" }, { name: "beta.txt" }];
  assert.deepEqual(filterEntriesByQuickFilter(entries, "alp"), [
    { name: "alpha.txt" },
  ]);
});

test("filterEntriesByQuickFilter filters by regex when query starts with /", () => {
  const entries = [{ name: "a1.txt" }, { name: "b2.txt" }, { name: "a3.txt" }];
  assert.deepEqual(
    filterEntriesByQuickFilter(entries, "/^a\\d"),
    [{ name: "a1.txt" }, { name: "a3.txt" }],
  );
});

test("parseQuickFilterMode detects plain vs regex and /i", () => {
  assert.deepEqual(parseQuickFilterMode("  doc  "), {
    kind: "substring",
    pattern: "doc",
  });
  assert.deepEqual(parseQuickFilterMode("/^file-"), {
    kind: "regex",
    pattern: "^file-",
    caseSensitive: true,
  });
  assert.deepEqual(parseQuickFilterMode("/foo/i"), {
    kind: "regex",
    pattern: "foo",
    caseSensitive: false,
  });
  assert.deepEqual(parseQuickFilterMode("/foo/"), {
    kind: "regex",
    pattern: "foo",
    caseSensitive: true,
  });
  assert.deepEqual(parseQuickFilterMode("/i/"), {
    kind: "regex",
    pattern: "i",
    caseSensitive: true,
  });
  assert.deepEqual(parseQuickFilterMode("//"), {
    kind: "regex",
    pattern: "",
    caseSensitive: true,
  });
  assert.deepEqual(parseQuickFilterMode("/foo/i/"), {
    kind: "regex",
    pattern: "foo",
    caseSensitive: false,
  });
  assert.equal(parseQuickFilterMode(""), null);
  assert.equal(parseQuickFilterMode("   "), null);
});

test("isValidQuickFilterRegex reports compile success", () => {
  assert.equal(isValidQuickFilterRegex("^a\\d+$"), true);
  assert.equal(isValidQuickFilterRegex("["), false);
  assert.equal(isValidQuickFilterRegex(""), true); // empty pattern is valid regex (matches empty)
});

test("isQuickFilterTypeaheadKey accepts printable filename chars and slash", () => {
  const base = {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  };
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: "a" }), true);
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: "1" }), true);
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: "-" }), true);
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: "." }), true);
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: "/" }), true);
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: "@" }), true);
  assert.equal(
    isQuickFilterTypeaheadKey({ ...base, shiftKey: true, key: "@" }),
    true,
  );
  assert.equal(
    isQuickFilterTypeaheadKey({ ...base, shiftKey: true, key: "A" }),
    true,
  );
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: " " }), false);
  assert.equal(isQuickFilterTypeaheadKey({ ...base, key: "\\" }), false);
  assert.equal(
    isQuickFilterTypeaheadKey({
      key: "ArrowDown",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    }),
    false,
  );
  assert.equal(
    isQuickFilterTypeaheadKey({
      key: "j",
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    }),
    false,
  );
});

test("quick filter match navigation skips non-matches", () => {
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
