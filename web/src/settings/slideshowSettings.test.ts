import assert from "node:assert/strict";
import test from "node:test";

import {
  SLIDESHOW_INTERVAL_DEFAULT,
  SLIDESHOW_INTERVAL_MIN,
  clampSlideshowInterval,
  commitSlideshowIntervalDraft,
  parseSlideshowAutoplay,
  parseSlideshowInterval,
} from "./slideshowSettings";

test("clampSlideshowInterval clamps seconds", () => {
  assert.equal(clampSlideshowInterval(0), SLIDESHOW_INTERVAL_MIN);
  assert.equal(clampSlideshowInterval(4.6), 4.6);
  assert.equal(clampSlideshowInterval(0.05), SLIDESHOW_INTERVAL_MIN);
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
  assert.equal(parseSlideshowInterval("2.5"), 2.5);
  assert.equal(parseSlideshowInterval("0"), SLIDESHOW_INTERVAL_MIN);
  assert.equal(parseSlideshowInterval(""), null);
  assert.equal(parseSlideshowInterval("nope"), null);
});

test("commitSlideshowIntervalDraft clamps on blur only", () => {
  assert.equal(commitSlideshowIntervalDraft("0.1", 4), 0.1);
  assert.equal(commitSlideshowIntervalDraft("0", 4), SLIDESHOW_INTERVAL_MIN);
  assert.equal(commitSlideshowIntervalDraft("", 4), 4);
  assert.equal(commitSlideshowIntervalDraft("nope", 4), 4);
});
