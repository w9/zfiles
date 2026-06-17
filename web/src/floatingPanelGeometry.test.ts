import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyResizeDelta,
  centerPanelGeometry,
  clampPanelGeometry,
  parseStoredPanelGeometry,
} from "./floatingPanelGeometry";

const VIEWPORT = { width: 1200, height: 800 };
const LIMITS = { minWidth: 320, minHeight: 240 };

test("centerPanelGeometry centers fixed-size panels in the viewport", () => {
  const geometry = centerPanelGeometry(480, 520, VIEWPORT, {
    minWidth: 480,
    minHeight: 520,
    maxWidth: 480,
    maxHeight: 520,
  });
  assert.equal(geometry.width, 480);
  assert.equal(geometry.height, 520);
  assert.equal(geometry.x, (VIEWPORT.width - 480) / 2);
  assert.equal(geometry.y, (VIEWPORT.height - 520) / 2);
});

test("clampPanelGeometry keeps the panel inside the viewport", () => {
  const clamped = clampPanelGeometry(
    { x: -40, y: -20, width: 2000, height: 1200 },
    VIEWPORT,
    LIMITS,
  );
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 0);
  assert.equal(clamped.width, VIEWPORT.width);
  assert.equal(clamped.height, VIEWPORT.height);
});

test("applyResizeDelta grows from the south-east corner", () => {
  const start = { x: 100, y: 100, width: 400, height: 300 };
  const resized = applyResizeDelta(start, "se", 50, 40, LIMITS);
  assert.deepEqual(resized, { x: 100, y: 100, width: 450, height: 340 });
});

test("parseStoredPanelGeometry accepts persisted numbers", () => {
  const parsed = parseStoredPanelGeometry(
    JSON.stringify({ x: 12, y: 34, width: 500, height: 400 }),
  );
  assert.deepEqual(parsed, { x: 12, y: 34, width: 500, height: 400 });
});
