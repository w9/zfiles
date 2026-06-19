export type CollapsedBreadcrumbMiddle = {
  showEllipsis: boolean;
  visibleMiddleIndices: number[];
  hiddenMiddleIndices: number[];
};

/** Middle segment indices between root (0) and the current page (partCount - 1). */
export function middleSegmentIndices(partCount: number): number[] {
  if (partCount <= 2) {
    return [];
  }
  return Array.from({ length: partCount - 2 }, (_, index) => index + 1);
}

/** Collapse middle segments from the start, keeping segments nearer the current page visible. */
export function collapsedBreadcrumbMiddle(
  partCount: number,
  hiddenMiddleFromStart: number,
): CollapsedBreadcrumbMiddle {
  const middle = middleSegmentIndices(partCount);
  if (middle.length === 0) {
    return {
      showEllipsis: false,
      visibleMiddleIndices: [],
      hiddenMiddleIndices: [],
    };
  }

  const hiddenCount = Math.min(
    Math.max(0, hiddenMiddleFromStart),
    middle.length,
  );

  return {
    showEllipsis: hiddenCount > 0,
    hiddenMiddleIndices: middle.slice(0, hiddenCount),
    visibleMiddleIndices: middle.slice(hiddenCount),
  };
}

export function pathForBreadcrumbPartIndex(
  parts: string[],
  index: number,
): string {
  if (index <= 0) {
    return "";
  }
  return parts.slice(1, index + 1).join("/");
}
