import assert from "node:assert/strict";
import test from "node:test";

import {
  SLIDESHOW_INTERVAL_DEFAULT,
  clampSlideshowInterval,
  parseSlideshowAutoplay,
  parseSlideshowInterval,
} from "./slideshowSettings";

test("clampSlideshowInterval clamps seconds", () => {
  assert.equal(clampSlideshowInterval(0), 1);
  assert.equal(clampSlideshowInterval(4.6), 5);
  assert.equal(clampSlideshowInterval(999), 300);
  assert.equal(clampSlideshowInterval(Number.NaN), SLIDESHOW_INTERVAL_DEFAULT);
});

test("parseSlideshowAutoplay parses storage values", () => {
  assert.equal(parseSlideshowAutoplay("true"), true);
  assert.equal(parseSlideshowAutoplay("false"), false);
  assert.equal(parseSlideshowAutoplay("maybe"), null);
});

test("parseSlideshowInterval parses storage values", () => {
  assert.equal(parseSlideshowInterval("8"), 8);
  assert.equal(parseSlideshowInterval("0"), 1);
  assert.equal(parseSlideshowInterval(""), null);
  assert.equal(parseSlideshowInterval("nope"), null);
});
