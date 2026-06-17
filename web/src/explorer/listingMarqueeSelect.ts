export type ClientRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type MarqueeModifiers = {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export const MARQUEE_DRAG_THRESHOLD_PX = 5;

export const MARQUEE_AUTO_SCROLL_MARGIN_PX = 40;

export const MARQUEE_AUTO_SCROLL_STEP_PX = 12;

export const LISTING_TABLE_ROW_HEIGHT_PX = 44;

export type ListingMarqueeEntryRect = { path: string; rect: ClientRect };

export type ListingMarqueeContentBounds = {
  contentTop: number;
  contentBottom: number;
  clientLeft: number;
  clientRight: number;
};

export type ListingMarqueeLayoutResolver = {
  entryCount: number;
  getEntryRects: (scrollElement: HTMLElement) => ListingMarqueeEntryRect[];
  hitTestContentMarquee: (
    scrollElement: HTMLElement,
    bounds: ListingMarqueeContentBounds,
  ) => string[];
  findPathAtClientPoint: (
    scrollElement: HTMLElement,
    clientX: number,
    clientY: number,
  ) => string | null;
};

export function pointerDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function normalizeMarqueeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): ClientRect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

export function rectsIntersect(a: ClientRect, b: ClientRect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

export function domRectToClientRect(rect: DOMRect): ClientRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

export function clientYToContentY(
  scrollElement: HTMLElement,
  clientY: number,
): number {
  const viewportRect = scrollElement.getBoundingClientRect();
  return scrollElement.scrollTop + (clientY - viewportRect.top);
}

export function clientXToContentX(
  scrollElement: HTMLElement,
  clientX: number,
): number {
  const viewportRect = scrollElement.getBoundingClientRect();
  return clientX - viewportRect.left;
}

function contentRangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  const a0 = Math.min(aStart, aEnd);
  const a1 = Math.max(aStart, aEnd);
  const b0 = Math.min(bStart, bEnd);
  const b1 = Math.max(bStart, bEnd);
  return a0 < b1 && a1 > b0;
}

export function hitTestTablePathsWithContentMarquee(
  scrollElement: HTMLElement,
  paths: readonly string[],
  bounds: ListingMarqueeContentBounds,
  rowHeight: number = LISTING_TABLE_ROW_HEIGHT_PX,
): string[] {
  const viewportRect = scrollElement.getBoundingClientRect();
  const contentTop = Math.min(bounds.contentTop, bounds.contentBottom);
  const contentBottom = Math.max(bounds.contentTop, bounds.contentBottom);
  const marqueeLeft = Math.min(bounds.clientLeft, bounds.clientRight);
  const marqueeRight = Math.max(bounds.clientLeft, bounds.clientRight);

  if (marqueeRight <= viewportRect.left || marqueeLeft >= viewportRect.right) {
    return [];
  }

  const hits: string[] = [];
  const startIndex = Math.max(0, Math.floor(contentTop / rowHeight));
  const endIndex = Math.min(paths.length, Math.ceil(contentBottom / rowHeight));
  for (let index = startIndex; index < endIndex; index++) {
    hits.push(paths[index]);
  }
  return hits;
}

export function findTablePathAtClientPoint(
  scrollElement: HTMLElement,
  paths: readonly string[],
  clientX: number,
  clientY: number,
  rowHeight: number = LISTING_TABLE_ROW_HEIGHT_PX,
): string | null {
  const viewportRect = scrollElement.getBoundingClientRect();
  if (
    clientX < viewportRect.left ||
    clientX > viewportRect.right ||
    clientY < viewportRect.top ||
    clientY > viewportRect.bottom
  ) {
    return null;
  }

  const index = Math.floor(clientYToContentY(scrollElement, clientY) / rowHeight);
  if (index < 0 || index >= paths.length) {
    return null;
  }
  return paths[index];
}

export function hitTestGridPathsWithContentMarquee(
  scrollElement: HTMLElement,
  paths: readonly string[],
  bounds: ListingMarqueeContentBounds,
  options: {
    columnCount: number;
    cardWidth: number;
    cardHeight: number;
    gap: number;
    padding: number;
  },
): string[] {
  const { columnCount, cardWidth, cardHeight, gap, padding } = options;
  if (columnCount <= 0) {
    return [];
  }

  const contentTop = Math.min(bounds.contentTop, bounds.contentBottom);
  const contentBottom = Math.max(bounds.contentTop, bounds.contentBottom);
  const contentLeft = Math.min(
    clientXToContentX(scrollElement, bounds.clientLeft),
    clientXToContentX(scrollElement, bounds.clientRight),
  );
  const contentRight = Math.max(
    clientXToContentX(scrollElement, bounds.clientLeft),
    clientXToContentX(scrollElement, bounds.clientRight),
  );

  const rowStride = cardHeight + gap;
  const colStride = cardWidth + gap;
  const hits: string[] = [];

  const minRow = Math.max(0, Math.floor((contentTop - padding) / rowStride));
  const maxRow = Math.ceil((contentBottom - padding) / rowStride);
  const minCol = Math.max(0, Math.floor((contentLeft - padding) / colStride));
  const maxCol = Math.min(
    columnCount,
    Math.ceil((contentRight - padding) / colStride),
  );

  for (let row = minRow; row < maxRow; row++) {
    for (let col = minCol; col < maxCol; col++) {
      const index = row * columnCount + col;
      if (index >= paths.length) {
        continue;
      }
      const cellTop = padding + row * rowStride;
      const cellBottom = cellTop + cardHeight;
      const cellLeft = padding + col * colStride;
      const cellRight = cellLeft + cardWidth;
      if (
        contentRangesOverlap(cellTop, cellBottom, contentTop, contentBottom) &&
        contentRangesOverlap(cellLeft, cellRight, contentLeft, contentRight)
      ) {
        hits.push(paths[index]);
      }
    }
  }

  return hits;
}

export function findGridPathAtClientPoint(
  scrollElement: HTMLElement,
  paths: readonly string[],
  clientX: number,
  clientY: number,
  options: {
    columnCount: number;
    cardWidth: number;
    cardHeight: number;
    gap: number;
    padding: number;
  },
): string | null {
  const { columnCount, cardWidth, cardHeight, gap, padding } = options;
  if (columnCount <= 0) {
    return null;
  }

  const viewportRect = scrollElement.getBoundingClientRect();
  if (
    clientX < viewportRect.left ||
    clientX > viewportRect.right ||
    clientY < viewportRect.top ||
    clientY > viewportRect.bottom
  ) {
    return null;
  }

  const contentX = clientXToContentX(scrollElement, clientX);
  const contentY = clientYToContentY(scrollElement, clientY);
  const rowStride = cardHeight + gap;
  const colStride = cardWidth + gap;
  const row = Math.floor((contentY - padding) / rowStride);
  const col = Math.floor((contentX - padding) / colStride);
  if (row < 0 || col < 0 || col >= columnCount) {
    return null;
  }

  const index = row * columnCount + col;
  if (index >= paths.length) {
    return null;
  }

  const cellTop = padding + row * rowStride;
  const cellLeft = padding + col * colStride;
  if (
    contentY < cellTop ||
    contentY > cellTop + cardHeight ||
    contentX < cellLeft ||
    contentX > cellLeft + cardWidth
  ) {
    return null;
  }

  return paths[index];
}

export function collectTableEntryRects(
  scrollElement: HTMLElement,
  paths: readonly string[],
  rowHeight: number = LISTING_TABLE_ROW_HEIGHT_PX,
): ListingMarqueeEntryRect[] {
  const viewportRect = scrollElement.getBoundingClientRect();
  const scrollTop = scrollElement.scrollTop;
  return paths.map((path, index) => {
    const start = index * rowHeight;
    const top = viewportRect.top + start - scrollTop;
    return {
      path,
      rect: {
        left: viewportRect.left,
        top,
        right: viewportRect.right,
        bottom: top + rowHeight,
      },
    };
  });
}

export function collectGridEntryRects(
  scrollElement: HTMLElement,
  paths: readonly string[],
  options: {
    columnCount: number;
    cardWidth: number;
    cardHeight: number;
    gap: number;
    padding: number;
  },
): ListingMarqueeEntryRect[] {
  const viewportRect = scrollElement.getBoundingClientRect();
  const scrollTop = scrollElement.scrollTop;
  const { columnCount, cardWidth, cardHeight, gap, padding } = options;
  if (columnCount <= 0) {
    return [];
  }

  const rowStride = cardHeight + gap;
  const colStride = cardWidth + gap;
  return paths.map((path, index) => {
    const row = Math.floor(index / columnCount);
    const col = index % columnCount;
    const top = viewportRect.top + padding + row * rowStride - scrollTop;
    const left = viewportRect.left + padding + col * colStride;
    return {
      path,
      rect: {
        left,
        top,
        right: left + cardWidth,
        bottom: top + cardHeight,
      },
    };
  });
}

export function collectDomEntryRectsFromViewport(
  scrollElement: HTMLElement,
): ListingMarqueeEntryRect[] {
  const nodes = scrollElement.querySelectorAll<HTMLElement>(
    "[data-listing-entry][data-listing-path]",
  );
  return Array.from(nodes).map((node) => ({
    path: node.dataset.listingPath ?? "",
    rect: domRectToClientRect(node.getBoundingClientRect()),
  }));
}

export function hitTestEntryPaths(
  marquee: ClientRect,
  entries: Array<{ path: string; rect: ClientRect }>,
): string[] {
  const hit: string[] = [];
  for (const entry of entries) {
    if (rectsIntersect(marquee, entry.rect)) {
      hit.push(entry.path);
    }
  }
  return hit;
}

export function findEntryPathAtPoint(
  entryRects: Array<{ path: string; rect: ClientRect }>,
  x: number,
  y: number,
): string | null {
  for (const { path, rect } of entryRects) {
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return path;
    }
  }
  return null;
}

export function computeMarqueeSelection(
  baseSelection: Set<string>,
  marqueePaths: Iterable<string>,
  modifiers: MarqueeModifiers,
): Set<string> {
  const inMarquee = new Set(marqueePaths);

  if (modifiers.ctrlKey || modifiers.metaKey) {
    const next = new Set(baseSelection);
    for (const path of inMarquee) {
      next.delete(path);
    }
    return next;
  }

  if (modifiers.shiftKey) {
    const next = new Set(baseSelection);
    for (const path of inMarquee) {
      next.add(path);
    }
    return next;
  }

  return new Set(inMarquee);
}

export function selectionSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const path of a) {
    if (!b.has(path)) {
      return false;
    }
  }
  return true;
}

export function shouldIgnoreMarqueePointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }
  if (target.closest("input, textarea, [data-prevent-marquee], [data-grid-resize-handle]")) {
    return true;
  }
  return false;
}

export function shouldClearMultiSelectionOnEmptyClick(options: {
  started: boolean;
  modifiers: MarqueeModifiers;
  target: EventTarget | null;
}): boolean {
  if (options.started) {
    return false;
  }
  if (
    options.modifiers.shiftKey ||
    options.modifiers.ctrlKey ||
    options.modifiers.metaKey
  ) {
    return false;
  }
  const target = options.target;
  if (
    target == null ||
    typeof target !== "object" ||
    typeof (target as Element).closest !== "function"
  ) {
    return false;
  }
  if ((target as Element).closest("[data-listing-entry]")) {
    return false;
  }
  return true;
}
