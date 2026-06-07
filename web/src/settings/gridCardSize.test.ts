import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILTIN_DEFAULT_GRID_CARD_SIZE,
  BUILTIN_MIN_GRID_CARD_SIZE,
  UNLIMITED_GRID_CARD_DIMENSION,
  clampGridCardSize,
  computeGridColumnCount,
  gridIconPixelSize,
  parseGridCardMaxSizeJson,
  parseGridCardSizeJson,
} from "./gridCardSize";

test("computeGridColumnCount auto-fits cards into the container width", () => {
  assert.equal(computeGridColumnCount(500, 120, 12), 3);
  assert.equal(computeGridColumnCount(120, 120, 12), 1);
  assert.equal(computeGridColumnCount(0, 120, 12), 1);
});

test("clampGridCardSize respects min and max bounds", () => {
  const min = BUILTIN_MIN_GRID_CARD_SIZE;
  const max = { width: 200, height: 240 };
  assert.deepEqual(
    clampGridCardSize({ width: 20, height: 20 }, min, max),
    { width: min.width, height: min.height },
  );
  assert.deepEqual(
    clampGridCardSize({ width: 400, height: 400 }, min, max),
    { width: 200, height: 240 },
  );
});

test("clampGridCardSize treats zero max dimensions as unlimited", () => {
  const max = {
    width: UNLIMITED_GRID_CARD_DIMENSION,
    height: UNLIMITED_GRID_CARD_DIMENSION,
  };
  assert.deepEqual(
    clampGridCardSize({ width: 900, height: 900 }, BUILTIN_MIN_GRID_CARD_SIZE, max),
    { width: 900, height: 900 },
  );
});

test("parseGridCardSizeJson falls back on invalid input", () => {
  assert.deepEqual(parseGridCardSizeJson(null, BUILTIN_DEFAULT_GRID_CARD_SIZE), {
    width: 120,
    height: 168,
  });
  assert.deepEqual(parseGridCardSizeJson("{bad", BUILTIN_DEFAULT_GRID_CARD_SIZE), {
    width: 120,
    height: 168,
  });
  assert.deepEqual(parseGridCardSizeJson('{"width":80,"height":100}', BUILTIN_DEFAULT_GRID_CARD_SIZE), {
    width: 80,
    height: 100,
  });
});

test("parseGridCardMaxSizeJson accepts unlimited dimensions", () => {
  assert.deepEqual(
    parseGridCardMaxSizeJson('{"width":0,"height":0}', {
      width: 200,
      height: 200,
    }),
    { width: 0, height: 0 },
  );
});

test("gridIconPixelSize scales with card dimensions", () => {
  assert.equal(gridIconPixelSize(48, 64), 16);
  assert.ok(gridIconPixelSize(200, 240) > gridIconPixelSize(80, 100));
});
