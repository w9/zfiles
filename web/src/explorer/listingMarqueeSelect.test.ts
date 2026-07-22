import assert from "node:assert/strict";
import test from "node:test";

import {
  collectGridEntryRects,
  collectTableEntryRects,
  computeMarqueeSelection,
  contentMarqueeToViewportLocal,
  hitTestEntryPaths,
  hitTestGridPathsWithContentMarquee,
  hitTestTablePathsWithContentMarquee,
  LISTING_TABLE_ROW_HEIGHT_PX,
  normalizeMarqueeRect,
  pointerDistance,
  rectsIntersect,
  selectionSetsEqual,
  shouldClearMultiSelectionOnEmptyClick,
  shouldIgnoreMarqueePointerTarget,
  syncListingSelectionDom,
} from "./listingMarqueeSelect";
import { buildGridVirtualRows } from "./gridListingLayout";

function mockScrollElement(scrollTop: number) {
  return {
    scrollTop,
    scrollLeft: 0,
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

test("contentMarqueeToViewportLocal keeps the content anchor under scroll", () => {
  const atRest = contentMarqueeToViewportLocal({
    startContentX: 20,
    startContentY: 100,
    contentX: 80,
    contentY: 180,
    scrollLeft: 0,
    scrollTop: 0,
  });
  assert.deepEqual(atRest, { left: 20, top: 100, right: 80, bottom: 180 });

  const scrolled = contentMarqueeToViewportLocal({
    startContentX: 20,
    startContentY: 100,
    contentX: 80,
    contentY: 280,
    scrollLeft: 0,
    scrollTop: 120,
  });
  // Start corner moves up with content; end grows with the longer content span.
  assert.deepEqual(scrolled, { left: 20, top: -20, right: 80, bottom: 160 });
});

test("contentMarqueeToViewportLocal orders inverted drag corners", () => {
  assert.deepEqual(
    contentMarqueeToViewportLocal({
      startContentX: 90,
      startContentY: 200,
      contentX: 10,
      contentY: 40,
      scrollLeft: 0,
      scrollTop: 0,
    }),
    { left: 10, top: 40, right: 90, bottom: 200 },
  );
});

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

function makeDomNode(path: string, selected: boolean, chrome?: ReturnType<typeof makeDomNode>) {
  const classes = new Set<string>(selected ? ["bg-primary/12"] : []);
  const node = {
    state: selected ? ("selected" as string | null) : null,
    classes,
    getAttribute(name: string) {
      return name === "data-listing-path" ? path : null;
    },
    setAttribute(name: string, value: string) {
      if (name === "data-state") {
        node.state = value;
      }
    },
    removeAttribute(name: string) {
      if (name === "data-state") {
        node.state = null;
      }
    },
    querySelector(selector: string) {
      if (
        chrome &&
        selector.includes("[data-listing-selection-chrome]")
      ) {
        return chrome;
      }
      return null;
    },
    classList: {
      add: (...tokens: string[]) => {
        for (const token of tokens) {
          classes.add(token);
        }
      },
      remove: (...tokens: string[]) => {
        for (const token of tokens) {
          classes.delete(token);
        }
      },
    },
  };
  return node;
}

test("syncListingSelectionDom toggles data-state on mounted entries", () => {
  const a = makeDomNode("/a", true);
  const b = makeDomNode("/b", false);
  syncListingSelectionDom(
    { querySelectorAll: () => [a, b] } as unknown as ParentNode,
    new Set(["/b"]),
  );
  assert.equal(a.state, null);
  assert.equal(b.state, "selected");
  assert.equal(a.classes.has("bg-primary/12"), false);
  assert.equal(b.classes.has("bg-primary/12"), true);
});

test("syncListingSelectionDom paints grid card chrome, not hit-expand entry", () => {
  const chrome = makeDomNode("/a", false);
  const entry = makeDomNode("/a", false, chrome);
  entry.classes.add("bg-primary/12");
  syncListingSelectionDom(
    { querySelectorAll: () => [entry] } as unknown as ParentNode,
    new Set(["/a"]),
  );
  assert.equal(entry.state, "selected");
  assert.equal(entry.classes.has("bg-primary/12"), false);
  assert.equal(chrome.classes.has("bg-primary/12"), true);
});

test("syncListingSelectionDom does not apply keyboard focus inset shadow", () => {
  const focusInset =
    "shadow-[inset_0_1px_6px_0_color-mix(in_oklab,var(--primary)_12%,transparent)]";
  const node = makeDomNode("/a", false);
  node.classes.add(focusInset);
  syncListingSelectionDom(
    { querySelectorAll: () => [node] } as unknown as ParentNode,
    new Set(["/a"]),
  );
  assert.equal(node.state, "selected");
  assert.equal(node.classes.has("bg-primary/12"), true);
  assert.equal(node.classes.has(focusInset), false);
});

test("pointerDistance measures drag length", () => {
  assert.equal(pointerDistance(0, 0, 3, 4), 5);
});

test("collectTableEntryRects maps virtual row indices to viewport coordinates", () => {
  const rowHeight = LISTING_TABLE_ROW_HEIGHT_PX;
  const scrollElement = {
    scrollTop: rowHeight,
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
    top: 100 - rowHeight,
    right: 210,
    bottom: 100,
  });
  assert.deepEqual(rects[1].rect, {
    left: 10,
    top: 100,
    right: 210,
    bottom: 100 + rowHeight,
  });
  assert.deepEqual(rects[2].rect, {
    left: 10,
    top: 100 + rowHeight,
    right: 210,
    bottom: 100 + rowHeight * 2,
  });
});

test("collectTableEntryRects hit-tests scrolled-out rows against marquee", () => {
  const scrollElement = {
    scrollTop: 10 * LISTING_TABLE_ROW_HEIGHT_PX,
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
  const marquee = normalizeMarqueeRect(
    0,
    0,
    100,
    LISTING_TABLE_ROW_HEIGHT_PX - 4,
  );
  const hit = hitTestEntryPaths(marquee, rects);
  assert.deepEqual(hit, ["/item-10"]);
});

test("collectGridEntryRects maps content cells on desktop (no gap expand)", () => {
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

test("collectGridEntryRects expands into gaps when expandHitIntoGaps", () => {
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
    expandHitIntoGaps: true,
  });

  // Hit rects expand halfway into inter-item gaps (gap=12 → 6px).
  assert.deepEqual(rects[0].rect, {
    left: 12,
    top: 12,
    right: 118,
    bottom: 98,
  });
  assert.deepEqual(rects[1].rect, {
    left: 118,
    top: 12,
    right: 224,
    bottom: 98,
  });
  assert.deepEqual(rects[2].rect, {
    left: 12,
    top: 98,
    right: 118,
    bottom: 184,
  });
});

test("hitTestTablePathsWithContentMarquee retract shrinks selection", () => {
  const rowHeight = LISTING_TABLE_ROW_HEIGHT_PX;
  const scrollElement = mockScrollElement(0);
  const paths = Array.from({ length: 30 }, (_, index) => `/item-${index}`);
  const wide = {
    contentTop: 0,
    contentBottom: 22 * rowHeight,
    clientLeft: 0,
    clientRight: 200,
  };
  const narrow = {
    contentTop: 0,
    contentBottom: 15 * rowHeight,
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
  const rowHeight = LISTING_TABLE_ROW_HEIGHT_PX;
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

  assert.equal(atScrollZero, Math.ceil(900 / rowHeight));
  assert.equal(afterScroll, Math.ceil(1400 / rowHeight));
  assert.ok(afterScroll > atScrollZero);
});

test("hitTestGridPathsWithContentMarquee respects content bounds", () => {
  const scrollElement = mockScrollElement(0);
  const paths = ["/a", "/b", "/c", "/d"];
  // First row content bottoms at 92; stop just above second-row content.
  const hit = hitTestGridPathsWithContentMarquee(
    scrollElement,
    paths,
    {
      contentTop: 0,
      contentBottom: 93,
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

test("hitTestGridPathsWithContentMarquee includes inter-item gap midpoints when expanded", () => {
  const scrollElement = mockScrollElement(0);
  const paths = ["/a", "/b", "/c", "/d"];
  const options = {
    columnCount: 2,
    cardWidth: 100,
    cardHeight: 80,
    gap: 12,
    padding: 12,
    expandHitIntoGaps: true,
  };
  // Horizontal gap between /a (right edge 112) and /b (left 124) meets at 118.
  const horizontal = hitTestGridPathsWithContentMarquee(
    scrollElement,
    paths,
    {
      contentTop: 40,
      contentBottom: 50,
      clientLeft: 116,
      clientRight: 120,
    },
    options,
  );
  assert.ok(horizontal.includes("/a") || horizontal.includes("/b"));
  assert.equal(horizontal.includes("/c"), false);

  // Vertical gap between row 0 (bottom 92) and row 1 (top 104) meets at 98.
  const vertical = hitTestGridPathsWithContentMarquee(
    scrollElement,
    paths,
    {
      contentTop: 96,
      contentBottom: 100,
      clientLeft: 20,
      clientRight: 40,
    },
    options,
  );
  assert.ok(vertical.includes("/a") || vertical.includes("/c"));
  assert.equal(vertical.includes("/b"), false);
});

test("hitTestGridPathsWithContentMarquee leaves desktop gaps as non-item areas", () => {
  const scrollElement = mockScrollElement(0);
  const paths = ["/a", "/b", "/c", "/d"];
  const options = {
    columnCount: 2,
    cardWidth: 100,
    cardHeight: 80,
    gap: 12,
    padding: 12,
  };
  const horizontal = hitTestGridPathsWithContentMarquee(
    scrollElement,
    paths,
    {
      contentTop: 40,
      contentBottom: 50,
      clientLeft: 116,
      clientRight: 120,
    },
    options,
  );
  assert.deepEqual(horizontal, []);

  const vertical = hitTestGridPathsWithContentMarquee(
    scrollElement,
    paths,
    {
      contentTop: 96,
      contentBottom: 100,
      clientLeft: 20,
      clientRight: 40,
    },
    options,
  );
  assert.deepEqual(vertical, []);
});

test("hitTestGridPathsWithContentMarquee ignores blank area right of last column", () => {
  const scrollElement = mockScrollElement(0);
  const columnCount = 13;
  const paths = Array.from({ length: 100 }, (_, index) => `/item-${index}`);
  const options = {
    columnCount,
    cardWidth: 120,
    cardHeight: 120,
    gap: 12,
    padding: 12,
  };
  const gridRight =
    options.padding +
    columnCount * options.cardWidth +
    (columnCount - 1) * options.gap;

  const hit = hitTestGridPathsWithContentMarquee(
    scrollElement,
    paths,
    {
      contentTop: 800,
      contentBottom: 1000,
      clientLeft: gridRight + 28,
      clientRight: gridRight + 66,
    },
    options,
  );

  assert.deepEqual(hit, []);
});

test("hitTestTablePathsWithContentMarquee range scan matches full-list bounds", () => {
  const rowHeight = LISTING_TABLE_ROW_HEIGHT_PX;
  const scrollElement = mockScrollElement(0);
  const paths = Array.from({ length: 10_000 }, (_, index) => `/item-${index}`);
  const bounds = {
    contentTop: 10 * rowHeight,
    contentBottom: 20 * rowHeight,
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

test("shouldClearMultiSelectionOnEmptyClick allows plain click on viewport background", () => {
  const viewport = { closest: () => null } as unknown as Element;
  assert.equal(
    shouldClearMultiSelectionOnEmptyClick({
      started: false,
      modifiers: { shiftKey: false, ctrlKey: false, metaKey: false },
      target: viewport,
    }),
    true,
  );
});

test("shouldIgnoreMarqueePointerTarget skips drag handles/surfaces but not bare entry padding", () => {
  const handle = {
    closest: (selector: string) =>
      selector.includes("[data-explorer-drag-handle]") ? handle : null,
  } as unknown as Element;
  const surface = {
    closest: (selector: string) =>
      selector.includes("[data-explorer-drag-surface]") ? surface : null,
  } as unknown as Element;
  const entryPadding = {
    closest: (selector: string) =>
      selector.includes("[data-listing-entry]") ? entryPadding : null,
  } as unknown as Element;
  const viewport = { closest: () => null } as unknown as Element;
  assert.equal(shouldIgnoreMarqueePointerTarget(handle), true);
  assert.equal(shouldIgnoreMarqueePointerTarget(surface), true);
  assert.equal(shouldIgnoreMarqueePointerTarget(entryPadding), false);
  assert.equal(shouldIgnoreMarqueePointerTarget(viewport), false);
  assert.equal(shouldIgnoreMarqueePointerTarget(null), true);
});

test("shouldClearMultiSelectionOnEmptyClick rejects drag, modifiers, and entry targets", () => {
  const entry = {
    closest: (selector: string) => (selector === "[data-listing-entry]" ? entry : null),
  } as unknown as Element;
  const viewport = { closest: () => null } as unknown as Element;
  const noModifiers = { shiftKey: false, ctrlKey: false, metaKey: false };

  assert.equal(
    shouldClearMultiSelectionOnEmptyClick({
      started: true,
      modifiers: noModifiers,
      target: viewport,
    }),
    false,
  );
  assert.equal(
    shouldClearMultiSelectionOnEmptyClick({
      started: false,
      modifiers: { shiftKey: true, ctrlKey: false, metaKey: false },
      target: viewport,
    }),
    false,
  );
  assert.equal(
    shouldClearMultiSelectionOnEmptyClick({
      started: false,
      modifiers: { shiftKey: false, ctrlKey: true, metaKey: false },
      target: viewport,
    }),
    false,
  );
  assert.equal(
    shouldClearMultiSelectionOnEmptyClick({
      started: false,
      modifiers: noModifiers,
      target: entry,
    }),
    false,
  );
});

test("collectGridEntryRects offsets file rows below section headers", () => {
  const scrollElement = mockScrollElement(0);
  const paths = ["/folder-a", "/folder-b", "/file-a", "/file-b"];
  const virtualRows = buildGridVirtualRows(paths.length, 2, 2);
  const rects = collectGridEntryRects(scrollElement, paths, {
    columnCount: 2,
    cardWidth: 100,
    cardHeight: 80,
    gap: 12,
    padding: 12,
    virtualRows,
  });

  assert.ok(rects[2]!.rect.top > rects[0]!.rect.top);
});
