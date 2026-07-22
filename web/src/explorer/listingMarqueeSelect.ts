import {
  buildGridVirtualRows,
  type GridListingLayoutMetrics,
  type GridVirtualRow,
  gridEntryHitRect,
} from "./gridListingLayout";

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

export const LISTING_TABLE_ROW_HEIGHT_PX = 36;

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

export type GridMarqueeLayoutOptions = {
  columnCount: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  padding: number;
  virtualRows?: readonly GridVirtualRow[];
  /** Touch UI: expand hit targets into inter-item gaps. Desktop leaves gaps empty. */
  expandHitIntoGaps?: boolean;
};

export function hitTestGridPathsWithContentMarquee(
  scrollElement: HTMLElement,
  paths: readonly string[],
  bounds: ListingMarqueeContentBounds,
  options: GridMarqueeLayoutOptions,
): string[] {
  const { columnCount } = options;
  if (columnCount <= 0) {
    return [];
  }

  const metrics = resolveGridMarqueeMetrics(paths, options);
  const hitOptions = { expandIntoGaps: options.expandHitIntoGaps === true };
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

  const hits: string[] = [];
  for (let index = 0; index < paths.length; index += 1) {
    const cell = gridEntryHitRect(index, metrics, hitOptions);
    if (!cell) {
      continue;
    }
    if (
      contentRangesOverlap(cell.top, cell.top + cell.height, contentTop, contentBottom) &&
      contentRangesOverlap(cell.left, cell.left + cell.width, contentLeft, contentRight)
    ) {
      hits.push(paths[index]!);
    }
  }

  return hits;
}

export function findGridPathAtClientPoint(
  scrollElement: HTMLElement,
  paths: readonly string[],
  clientX: number,
  clientY: number,
  options: GridMarqueeLayoutOptions,
): string | null {
  const { columnCount } = options;
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

  const metrics = resolveGridMarqueeMetrics(paths, options);
  const hitOptions = { expandIntoGaps: options.expandHitIntoGaps === true };
  const contentX = clientXToContentX(scrollElement, clientX);
  const contentY = clientYToContentY(scrollElement, clientY);

  for (let index = paths.length - 1; index >= 0; index -= 1) {
    const cell = gridEntryHitRect(index, metrics, hitOptions);
    if (!cell) {
      continue;
    }
    if (
      contentY >= cell.top &&
      contentY <= cell.top + cell.height &&
      contentX >= cell.left &&
      contentX <= cell.left + cell.width
    ) {
      return paths[index] ?? null;
    }
  }

  return null;
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
  options: GridMarqueeLayoutOptions,
): ListingMarqueeEntryRect[] {
  const viewportRect = scrollElement.getBoundingClientRect();
  const scrollTop = scrollElement.scrollTop;
  const { columnCount } = options;
  if (columnCount <= 0) {
    return [];
  }

  const metrics = resolveGridMarqueeMetrics(paths, options);
  const hitOptions = { expandIntoGaps: options.expandHitIntoGaps === true };
  return paths.flatMap((path, index) => {
    const cell = gridEntryHitRect(index, metrics, hitOptions);
    if (!cell) {
      return [];
    }
    const top = viewportRect.top + cell.top - scrollTop;
    const left = viewportRect.left + cell.left;
    return [
      {
        path,
        rect: {
          left,
          top,
          right: left + cell.width,
          bottom: top + cell.height,
        },
      },
    ];
  });
}

function resolveGridMarqueeMetrics(
  paths: readonly string[],
  options: GridMarqueeLayoutOptions,
): GridListingLayoutMetrics {
  return {
    columnCount: options.columnCount,
    cardWidth: options.cardWidth,
    cardHeight: options.cardHeight,
    gap: options.gap,
    padding: options.padding,
    virtualRows:
      options.virtualRows ??
      buildGridVirtualRows(paths.length, options.columnCount, 0),
  };
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

/** Plain selected chrome only — never the keyboard-focus inset shadow. */
const MARQUEE_LIVE_SELECTED_CLASSES = [
  "bg-primary/12",
  "hover:bg-primary/16",
] as const;

/** Keyboard-nav inset; strip if present so marquee never leaves focus chrome. */
const LISTING_ROW_FOCUS_INSET_CLASS =
  "shadow-[inset_0_1px_6px_0_color-mix(in_oklab,var(--primary)_12%,transparent)]";

/**
 * Paint selection on currently mounted listing entries without a React commit.
 * Used while a marquee drag is active so highlights track the rect immediately.
 * Grid cards expose `[data-listing-selection-chrome]` on the visual card so the
 * hit-expand button never receives the selection wash.
 */
export function syncListingSelectionDom(
  root: ParentNode | null,
  selected: ReadonlySet<string>,
): void {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }
  const nodes = root.querySelectorAll<HTMLElement>(
    "[data-listing-entry][data-listing-path]",
  );
  for (const entry of nodes) {
    const path = entry.getAttribute("data-listing-path");
    if (!path) {
      continue;
    }
    const chrome =
      (typeof entry.querySelector === "function"
        ? entry.querySelector<HTMLElement>("[data-listing-selection-chrome]")
        : null) ?? entry;
    if (chrome !== entry) {
      // Clear any leftover wash on the expanded hit target.
      entry.classList.remove(
        ...MARQUEE_LIVE_SELECTED_CLASSES,
        LISTING_ROW_FOCUS_INSET_CLASS,
      );
    }
    const shouldSelect = selected.has(path);
    if (shouldSelect) {
      entry.setAttribute("data-state", "selected");
      chrome.classList.add(...MARQUEE_LIVE_SELECTED_CLASSES);
      // Marquee must not apply keyboard focus chrome; also clears a prior
      // focus inset left on memoized rows that skip re-render.
      chrome.classList.remove(LISTING_ROW_FOCUS_INSET_CLASS);
    } else {
      entry.removeAttribute("data-state");
      chrome.classList.remove(
        ...MARQUEE_LIVE_SELECTED_CLASSES,
        LISTING_ROW_FOCUS_INSET_CLASS,
      );
    }
  }
}

export function shouldIgnoreMarqueePointerTarget(target: EventTarget | null): boolean {
  if (
    target == null ||
    typeof target !== "object" ||
    typeof (target as Element).closest !== "function"
  ) {
    return true;
  }
  // Drag handles / selected drag surface own the gesture; elsewhere on a row
  // (e.g. size/date columns) may start marquee. Empty viewport still marquees.
  if (
    (target as Element).closest(
      "input, textarea, [data-prevent-marquee], [data-grid-resize-handle], [data-explorer-drag-handle], [data-explorer-drag-surface]",
    )
  ) {
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
