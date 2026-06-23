import assert from "node:assert/strict";
import test from "node:test";

import {
  columnHeaderAriaSort,
  listingColumnHeaderAlignClass,
  listingColumnHeaderSortIconFirst,
} from "@/components/data-table-column-header";

test("columnHeaderAriaSort maps tanstack sort state to aria-sort", () => {
  assert.equal(columnHeaderAriaSort(false), "none");
  assert.equal(columnHeaderAriaSort("asc"), "ascending");
  assert.equal(columnHeaderAriaSort("desc"), "descending");
});

test("listingColumnHeaderAlignClass maps column headerAlign to flex justification", () => {
  assert.equal(listingColumnHeaderAlignClass("start"), undefined);
  assert.equal(listingColumnHeaderAlignClass("end"), "justify-end");
});

test("listingColumnHeaderSortIconFirst places sort icon before text only when end-aligned", () => {
  assert.equal(listingColumnHeaderSortIconFirst("start"), false);
  assert.equal(listingColumnHeaderSortIconFirst("end"), true);
});
