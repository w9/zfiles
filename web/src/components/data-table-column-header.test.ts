import assert from "node:assert/strict";
import test from "node:test";

import { columnHeaderAriaSort } from "@/components/data-table-column-header";

test("columnHeaderAriaSort maps tanstack sort state to aria-sort", () => {
  assert.equal(columnHeaderAriaSort(false), "none");
  assert.equal(columnHeaderAriaSort("asc"), "ascending");
  assert.equal(columnHeaderAriaSort("desc"), "descending");
});
