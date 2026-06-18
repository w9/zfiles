import assert from "node:assert/strict";
import test from "node:test";

import { moveGridIndex, moveLinearIndex } from "./listingGridNavigation";

test("moveLinearIndex clamps to list bounds", () => {
  assert.equal(moveLinearIndex(2, 1, 5), 3);
  assert.equal(moveLinearIndex(4, 1, 5), 4);
  assert.equal(moveLinearIndex(0, -1, 5), 0);
  assert.equal(moveLinearIndex(0, 0, 0), 0);
});

test("moveGridIndex moves horizontally within a row", () => {
  assert.equal(moveGridIndex(1, "left", 4, 10), 0);
  assert.equal(moveGridIndex(1, "right", 4, 10), 2);
});

test("moveGridIndex clamps at horizontal edges", () => {
  assert.equal(moveGridIndex(0, "left", 4, 10), 0);
  assert.equal(moveGridIndex(3, "right", 4, 10), 3);
  assert.equal(moveGridIndex(9, "right", 4, 10), 9);
});

test("moveGridIndex moves vertically within the same column", () => {
  assert.equal(moveGridIndex(1, "down", 4, 10), 5);
  assert.equal(moveGridIndex(5, "up", 4, 10), 1);
});

test("moveGridIndex clamps at vertical edges and partial last row", () => {
  assert.equal(moveGridIndex(2, "up", 4, 10), 2);
  assert.equal(moveGridIndex(9, "down", 4, 10), 9);
  assert.equal(moveGridIndex(8, "down", 4, 10), 8);
  assert.equal(moveGridIndex(8, "right", 4, 10), 9);
});

test("moveGridIndex crosses section boundaries when folderCount is set", () => {
  assert.equal(moveGridIndex(1, "down", 4, 6, { folderCount: 2 }), 3);
  assert.equal(moveGridIndex(5, "up", 4, 6, { folderCount: 2 }), 1);
});
