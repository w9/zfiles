import assert from "node:assert/strict";
import test from "node:test";

import {
  layoutToListingRowGridTemplate,
  listingColumnGutterGridColumn,
  listingDataCellGridColumn,
  prependIconColumnToMeasuredGridTemplate,
} from "@/listing-table-layout";
import { LISTING_ICON_COLUMN_WIDTH_PX } from "@/listing-styles";

test("layoutToListingRowGridTemplate prepends the fixed icon column", () => {
  const template = layoutToListingRowGridTemplate(
    { name: 55, size: 18, modified: 27 },
    1000,
  );
  assert.match(template, new RegExp(`^${LISTING_ICON_COLUMN_WIDTH_PX}px `));
});

test("layoutToListingRowGridTemplate allocates resizable width after icon and separators", () => {
  const template = layoutToListingRowGridTemplate(
    { name: 50, size: 25, modified: 25 },
    1002,
  );
  const available = 1002 - 2 - LISTING_ICON_COLUMN_WIDTH_PX;
  assert.equal(
    template,
    `${LISTING_ICON_COLUMN_WIDTH_PX}px ${available * 0.5}px 1px ${available * 0.25}px 1px ${available * 0.25}px`,
  );
});

test("listing grid column helpers offset data cells for the icon column", () => {
  assert.equal(listingDataCellGridColumn(0), 2);
  assert.equal(listingColumnGutterGridColumn(1), 3);
  assert.equal(listingDataCellGridColumn(2), 6);
});

test("prependIconColumnToMeasuredGridTemplate preserves measured resizable tracks", () => {
  assert.equal(
    prependIconColumnToMeasuredGridTemplate("120px 1px 80px 1px 60px"),
    `${LISTING_ICON_COLUMN_WIDTH_PX}px 120px 1px 80px 1px 60px`,
  );
});
