import assert from "node:assert/strict";
import test from "node:test";

import { ZOOM_HUD_VISIBLE_MS, nextZoomHudBaseline } from "./slideshowZoomHud";

test("ZOOM_HUD_VISIBLE_MS is 1s", () => {
  assert.equal(ZOOM_HUD_VISIBLE_MS, 1000);
});

test("nextZoomHudBaseline does not reveal while establishing baseline", () => {
  assert.deepEqual(nextZoomHudBaseline(null, 100), { baseline: 100, reveal: false });
  assert.deepEqual(nextZoomHudBaseline(null, 50), { baseline: 50, reveal: false });
});

test("nextZoomHudBaseline does not reveal when percent is unchanged", () => {
  assert.deepEqual(nextZoomHudBaseline(100, 100), { baseline: 100, reveal: false });
  assert.deepEqual(nextZoomHudBaseline(50, 50), { baseline: 50, reveal: false });
});

test("nextZoomHudBaseline reveals when percent changes", () => {
  assert.deepEqual(nextZoomHudBaseline(100, 125), { baseline: 125, reveal: true });
  assert.deepEqual(nextZoomHudBaseline(50, 100), { baseline: 100, reveal: true });
});
