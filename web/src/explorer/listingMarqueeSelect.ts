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

export function shouldIgnoreMarqueePointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }
  if (target.closest("input, textarea, [data-prevent-marquee], [data-grid-resize-handle]")) {
    return true;
  }
  return false;
}
