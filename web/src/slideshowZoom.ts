export type ZoomMode = "default" | "fit" | "one-to-one" | "manual";

export const ZOOM_STEP = 0.25;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

export function fitScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return 1;
  }
  return Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
}

export function defaultScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  return Math.min(1, fitScale(naturalWidth, naturalHeight, viewportWidth, viewportHeight));
}

export function resolveImageScale(
  mode: ZoomMode,
  manualScale: number,
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const fit = fitScale(naturalWidth, naturalHeight, viewportWidth, viewportHeight);
  switch (mode) {
    case "fit":
      return fit;
    case "one-to-one":
      return 1;
    case "manual":
      return manualScale;
    case "default":
    default:
      return defaultScale(naturalWidth, naturalHeight, viewportWidth, viewportHeight);
  }
}

export function stepZoom(scale: number, delta: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale + delta * ZOOM_STEP));
}

export function wheelZoomScale(current: number, deltaY: number): number {
  const factor = deltaY < 0 ? 1.1 : 1 / 1.1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
}

export function formatZoomPercentage(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 100;
  }
  return Math.round(scale * 100);
}

export function pinchZoomScale(current: number, ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return current;
  }
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * ratio));
}
