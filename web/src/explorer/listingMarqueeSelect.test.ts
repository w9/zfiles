import assert from "node:assert/strict";
import test from "node:test";

import {
  collectGridEntryRects,
  collectTableEntryRects,
  computeMarqueeSelection,
  hitTestEntryPaths,
  hitTestGridPathsWithContentMarquee,
  hitTestTablePathsWithContentMarquee,
  normalizeMarqueeRect,
  pointerDistance,
  rectsIntersect,
  selectionSetsEqual,
} from "./listingMarqueeSelect";

function mockScrollElement(scrollTop: number) {
  return {
    scrollTop,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 400,
      width: 200,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;
}

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

test("collectTableEntryRects maps virtual row indices to viewport coordinates", () => {
  const scrollElement = {
    scrollTop: 44,
    getBoundingClientRect: () => ({
      left: 10,
      top: 100,
      right: 210,
      bottom: 500,
      width: 200,
      height: 400,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;

  const rects = collectTableEntryRects(scrollElement, ["/a", "/b", "/c"]);
  assert.deepEqual(rects[0].rect, {
    left: 10,
    top: 56,
    right: 210,
    bottom: 100,
  });
  assert.deepEqual(rects[1].rect, {
    left: 10,
    top: 100,
    right: 210,
    bottom: 144,
  });
  assert.deepEqual(rects[2].rect, {
    left: 10,
    top: 144,
    right: 210,
    bottom: 188,
  });
});

test("collectTableEntryRects hit-tests scrolled-out rows against marquee", () => {
  const scrollElement = {
    scrollTop: 440,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 300,
      width: 100,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;

  const paths = Array.from({ length: 20 }, (_, index) => `/item-${index}`);
  const rects = collectTableEntryRects(scrollElement, paths);
  const marquee = normalizeMarqueeRect(0, 0, 100, 40);
  const hit = hitTestEntryPaths(marquee, rects);
  assert.deepEqual(hit, ["/item-10"]);
});

test("collectGridEntryRects maps grid cells to viewport coordinates", () => {
  const scrollElement = {
    scrollTop: 0,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;

  const rects = collectGridEntryRects(scrollElement, ["/a", "/b", "/c", "/d"], {
    columnCount: 2,
    cardWidth: 100,
    cardHeight: 80,
    gap: 12,
    padding: 12,
  });

  assert.deepEqual(rects[0].rect, {
    left: 12,
    top: 12,
    right: 112,
    bottom: 92,
  });
  assert.deepEqual(rects[1].rect, {
    left: 124,
    top: 12,
    right: 224,
    bottom: 92,
  });
  assert.deepEqual(rects[2].rect, {
    left: 12,
    top: 104,
    right: 112,
    bottom: 184,
  });
});

test("hitTestTablePathsWithContentMarquee retract shrinks selection", () => {
  const scrollElement = mockScrollElement(0);
  const paths = Array.from({ length: 30 }, (_, index) => `/item-${index}`);
  const wide = {
    contentTop: 0,
    contentBottom: 22 * 44,
    clientLeft: 0,
    clientRight: 200,
  };
  const narrow = {
    contentTop: 0,
    contentBottom: 15 * 44,
    clientLeft: 0,
    clientRight: 200,
  };

  assert.equal(
    hitTestTablePathsWithContentMarquee(scrollElement, paths, wide).length,
    22,
  );
  assert.equal(
    hitTestTablePathsWithContentMarquee(scrollElement, paths, narrow).length,
    15,
  );
});

test("hitTestTablePathsWithContentMarquee auto-scroll extends swept range", () => {
  const paths = Array.from({ length: 40 }, (_, index) => `/item-${index}`);
  const bounds = {
    contentTop: 0,
    contentBottom: 900,
    clientLeft: 0,
    clientRight: 200,
  };

  const atScrollZero = hitTestTablePathsWithContentMarquee(
    mockScrollElement(0),
    paths,
    bounds,
  ).length;
  const afterScroll = hitTestTablePathsWithContentMarquee(
    mockScrollElement(500),
    paths,
    { ...bounds, contentBottom: 1400 },
  ).length;

  assert.equal(atScrollZero, 21);
  assert.equal(afterScroll, 32);
  assert.ok(afterScroll > atScrollZero);
});

test("hitTestGridPathsWithContentMarquee respects content bounds", () => {
  const scrollElement = mockScrollElement(0);
  const paths = ["/a", "/b", "/c", "/d"];
  const hit = hitTestGridPathsWithContentMarquee(
    scrollElement,
    paths,
    {
      contentTop: 0,
      contentBottom: 100,
      clientLeft: 0,
      clientRight: 200,
    },
    {
      columnCount: 2,
      cardWidth: 100,
      cardHeight: 80,
      gap: 12,
      padding: 12,
    },
  );

  assert.deepEqual(hit, ["/a", "/b"]);
});

test("hitTestTablePathsWithContentMarquee range scan matches full-list bounds", () => {
  const scrollElement = mockScrollElement(0);
  const paths = Array.from({ length: 10_000 }, (_, index) => `/item-${index}`);
  const bounds = {
    contentTop: 440,
    contentBottom: 880,
    clientLeft: 0,
    clientRight: 200,
  };
  const ranged = hitTestTablePathsWithContentMarquee(scrollElement, paths, bounds);
  assert.deepEqual(ranged, ["/item-10", "/item-11", "/item-12", "/item-13", "/item-14", "/item-15", "/item-16", "/item-17", "/item-18", "/item-19"]);
});

test("selectionSetsEqual compares set membership", () => {
  assert.equal(selectionSetsEqual(new Set(["/a"]), new Set(["/a"])), true);
  assert.equal(selectionSetsEqual(new Set(["/a"]), new Set(["/b"])), false);
  assert.equal(selectionSetsEqual(new Set(["/a", "/b"]), new Set(["/b"])), false);
});
