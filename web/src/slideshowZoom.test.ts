import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultScale,
  fitScale,
  formatZoomPercentage,
  pinchZoomScale,
  resolveImageScale,
  stepZoom,
  wheelZoomScale,
} from "./slideshowZoom";

test("fitScale and defaultScale compute viewport scaling", () => {
  assert.equal(fitScale(2000, 1000, 1000, 500), 0.5);
  assert.equal(defaultScale(800, 600, 1000, 800), 1);
  assert.equal(defaultScale(2000, 1000, 1000, 500), 0.5);
});

test("resolveImageScale respects zoom mode", () => {
  assert.equal(resolveImageScale("fit", 1, 2000, 1000, 1000, 500), 0.5);
  assert.equal(resolveImageScale("one-to-one", 1, 2000, 1000, 1000, 500), 1);
  assert.equal(resolveImageScale("manual", 2, 2000, 1000, 1000, 500), 2);
});

test("stepZoom and wheelZoomScale stay within bounds", () => {
  assert.equal(stepZoom(1, 1), 1.25);
  assert.equal(stepZoom(0.05, -1), 0.1);
  assert.ok(wheelZoomScale(1, -100) > 1);
  assert.ok(wheelZoomScale(8, -100) <= 8);
});

test("formatZoomPercentage rounds scale to whole percent", () => {
  assert.equal(formatZoomPercentage(1), 100);
  assert.equal(formatZoomPercentage(0.5), 50);
  assert.equal(formatZoomPercentage(1.25), 125);
  assert.equal(formatZoomPercentage(Number.NaN), 100);
});

test("pinchZoomScale scales by ratio with bounds", () => {
  assert.equal(pinchZoomScale(1, 2), 2);
  assert.equal(pinchZoomScale(8, 2), 8);
  assert.equal(pinchZoomScale(1, 0), 1);
});
