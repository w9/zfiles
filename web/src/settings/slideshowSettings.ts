export const SLIDESHOW_START_AT_ACTIVE_STORAGE_KEY = "zfiles-slideshow-start-at-active";

export function parseStoredBoolean(value: string | null): boolean | null {
  if (value === "1" || value === "true") {
    return true;
  }
  if (value === "0" || value === "false") {
    return false;
  }
  return null;
}

export function defaultSlideshowStartAtActiveItem(): boolean {
  return false;
}

export function readStoredSlideshowStartAtActiveItem(): boolean {
  if (typeof window === "undefined") {
    return defaultSlideshowStartAtActiveItem();
  }
  const stored = window.localStorage.getItem(SLIDESHOW_START_AT_ACTIVE_STORAGE_KEY);
  return parseStoredBoolean(stored) ?? defaultSlideshowStartAtActiveItem();
}

export function storeSlideshowStartAtActiveItem(enabled: boolean): void {
  window.localStorage.setItem(
    SLIDESHOW_START_AT_ACTIVE_STORAGE_KEY,
    enabled ? "true" : "false",
  );
}
