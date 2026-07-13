import { pinchZoomScale as scaleFromPinchRatio } from "./slideshowZoom";

export type PanOffset = { x: number; y: number };

export const DRAG_CLICK_THRESHOLD_PX = 5;

export function panOffsetFromDrag(
  startPan: PanOffset,
  startPointer: { x: number; y: number },
  currentPointer: { x: number; y: number },
): PanOffset {
  return {
    x: startPan.x + (currentPointer.x - startPointer.x),
    y: startPan.y + (currentPointer.y - startPointer.y),
  };
}

export function panOffsetForZoomAtPoint(
  pan: PanOffset,
  cursorOffsetFromImageCenter: PanOffset,
  oldScale: number,
  newScale: number,
): PanOffset {
  if (oldScale <= 0 || newScale === oldScale) {
    return pan;
  }
  const ratio = newScale / oldScale;
  const scaleDelta = ratio - 1;
  return {
    x: pan.x - cursorOffsetFromImageCenter.x * scaleDelta,
    y: pan.y - cursorOffsetFromImageCenter.y * scaleDelta,
  };
}

export function pointerDragDistance(
  start: { x: number; y: number },
  current: { x: number; y: number },
): number {
  return Math.hypot(current.x - start.x, current.y - start.y);
}

export function dragExceededClickThreshold(distance: number): boolean {
  return distance > DRAG_CLICK_THRESHOLD_PX;
}

export function scaledImageSize(
  naturalWidth: number,
  naturalHeight: number,
  scale: number,
): { width: number; height: number } {
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

export function imageOverflowsViewport(
  naturalWidth: number,
  naturalHeight: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  const { width, height } = scaledImageSize(naturalWidth, naturalHeight, scale);
  return width > viewportWidth || height > viewportHeight;
}

export function showGrabCursor(overflows: boolean, pan: PanOffset): boolean {
  return overflows || pan.x !== 0 || pan.y !== 0;
}

export function touchPairDistance(
  touches: ArrayLike<{ clientX: number; clientY: number }>,
): number {
  if (touches.length < 2) {
    return 0;
  }
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/** Midpoint of the first two touches in client coordinates. */
export function touchPairMidpoint(
  touches: ArrayLike<{ clientX: number; clientY: number }>,
): { x: number; y: number } | null {
  if (touches.length < 2) {
    return null;
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

/**
 * Pan after a pinch that zooms around the initial midpoint and follows
 * midpoint translation (simultaneous pan + zoom).
 * Midpoint offsets are relative to the image visual center
 * (layout/viewport center + current pan).
 */
export function panOffsetForPinch(
  initialPan: PanOffset,
  initialMidOffsetFromCenter: PanOffset,
  currentMidOffsetFromCenter: PanOffset,
  initialScale: number,
  currentScale: number,
): PanOffset {
  const afterZoom = panOffsetForZoomAtPoint(
    initialPan,
    initialMidOffsetFromCenter,
    initialScale,
    currentScale,
  );
  return {
    x: afterZoom.x + (currentMidOffsetFromCenter.x - initialMidOffsetFromCenter.x),
    y: afterZoom.y + (currentMidOffsetFromCenter.y - initialMidOffsetFromCenter.y),
  };
}

export function pinchZoomScale(
  initialScale: number,
  initialDistance: number,
  currentDistance: number,
): number {
  if (initialDistance <= 0 || currentDistance <= 0) {
    return initialScale;
  }
  return scaleFromPinchRatio(initialScale, currentDistance / initialDistance);
}
