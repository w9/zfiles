import assert from "node:assert/strict";
import test from "node:test";

import {
  computeMarqueeSelection,
  hitTestEntryPaths,
  normalizeMarqueeRect,
  pointerDistance,
  rectsIntersect,
} from "./listingMarqueeSelect";

test("normalizeMarqueeRect orders corners regardless of drag direction", () => {
  assert.deepEqual(normalizeMarqueeRect(10, 20, 30, 5), {
    left: 10,
    top: 5,
    right: 30,
    bottom: 20,
  });
});

test("rectsIntersect detects overlap and separation", () => {
  const a = { left: 0, top: 0, right: 10, bottom: 10 };
  const b = { left: 5, top: 5, right: 15, bottom: 15 };
  const c = { left: 20, top: 20, right: 30, bottom: 30 };
  assert.equal(rectsIntersect(a, b), true);
  assert.equal(rectsIntersect(a, c), false);
});

test("hitTestEntryPaths returns paths whose bounds intersect the marquee", () => {
  const marquee = normalizeMarqueeRect(0, 0, 15, 15);
  const hit = hitTestEntryPaths(marquee, [
    { path: "/a", rect: { left: 0, top: 0, right: 10, bottom: 10 } },
    { path: "/b", rect: { left: 20, top: 20, right: 30, bottom: 30 } },
    { path: "/c", rect: { left: 12, top: 12, right: 18, bottom: 18 } },
  ]);
  assert.deepEqual(hit, ["/a", "/c"]);
});

test("computeMarqueeSelection replaces without modifiers", () => {
  const base = new Set(["/keep"]);
  const next = computeMarqueeSelection(base, ["/a", "/b"], {
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
  });
  assert.deepEqual([...next].sort(), ["/a", "/b"]);
});

test("computeMarqueeSelection unions on shift", () => {
  const base = new Set(["/keep"]);
  const next = computeMarqueeSelection(base, ["/a"], {
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
  });
  assert.deepEqual([...next].sort(), ["/a", "/keep"]);
});

test("computeMarqueeSelection deselects marquee hits on ctrl", () => {
  const base = new Set(["/a", "/keep"]);
  const next = computeMarqueeSelection(base, ["/a", "/b"], {
    shiftKey: false,
    ctrlKey: true,
    metaKey: false,
  });
  assert.deepEqual([...next].sort(), ["/keep"]);
});

test("computeMarqueeSelection does not add unselected paths on ctrl", () => {
  const base = new Set(["/keep"]);
  const next = computeMarqueeSelection(base, ["/new"], {
    shiftKey: false,
    ctrlKey: true,
    metaKey: false,
  });
  assert.deepEqual([...next].sort(), ["/keep"]);
});

test("pointerDistance measures drag length", () => {
  assert.equal(pointerDistance(0, 0, 3, 4), 5);
});
