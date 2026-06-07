export const SLIDESHOW_AUTOPLAY_STORAGE_KEY = "zfiles-slideshow-autoplay";
export const SLIDESHOW_INTERVAL_STORAGE_KEY = "zfiles-slideshow-interval";

export const SLIDESHOW_INTERVAL_MIN = 1;
export const SLIDESHOW_INTERVAL_MAX = 300;
export const SLIDESHOW_INTERVAL_DEFAULT = 4;

export function clampSlideshowInterval(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return SLIDESHOW_INTERVAL_DEFAULT;
  }
  return Math.min(
    SLIDESHOW_INTERVAL_MAX,
    Math.max(SLIDESHOW_INTERVAL_MIN, Math.round(seconds)),
  );
}

export function parseSlideshowAutoplay(value: string | null): boolean | null {
  if (value === "1" || value === "true") {
    return true;
  }
  if (value === "0" || value === "false") {
    return false;
  }
  return null;
}

export function defaultSlideshowAutoplay(): boolean {
  return false;
}

export function readStoredSlideshowAutoplay(): boolean {
  if (typeof window === "undefined") {
    return defaultSlideshowAutoplay();
  }
  const stored = window.localStorage.getItem(SLIDESHOW_AUTOPLAY_STORAGE_KEY);
  return parseSlideshowAutoplay(stored) ?? defaultSlideshowAutoplay();
}

export function storeSlideshowAutoplay(enabled: boolean): void {
  window.localStorage.setItem(SLIDESHOW_AUTOPLAY_STORAGE_KEY, enabled ? "true" : "false");
}

export function parseSlideshowInterval(value: string | null): number | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return clampSlideshowInterval(parsed);
}

export function readStoredSlideshowInterval(): number {
  if (typeof window === "undefined") {
    return SLIDESHOW_INTERVAL_DEFAULT;
  }
  const stored = window.localStorage.getItem(SLIDESHOW_INTERVAL_STORAGE_KEY);
  return parseSlideshowInterval(stored) ?? SLIDESHOW_INTERVAL_DEFAULT;
}

export function storeSlideshowInterval(seconds: number): void {
  window.localStorage.setItem(
    SLIDESHOW_INTERVAL_STORAGE_KEY,
    String(clampSlideshowInterval(seconds)),
  );
}
