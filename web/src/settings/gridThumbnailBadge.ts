export const GRID_THUMBNAIL_BADGE_STORAGE_KEY = "zfiles-grid-thumbnail-badge";

export type BootMode = "local" | "cloud";

export function defaultGridThumbnailBadge(_bootMode: BootMode): boolean {
  return true;
}

export function parseGridThumbnailBadge(value: string | null): boolean | null {
  if (value === "1" || value === "true") {
    return true;
  }
  if (value === "0" || value === "false") {
    return false;
  }
  return null;
}

export function readStoredGridThumbnailBadge(bootMode: BootMode): boolean {
  if (typeof window === "undefined") {
    return defaultGridThumbnailBadge(bootMode);
  }
  const stored = window.localStorage.getItem(GRID_THUMBNAIL_BADGE_STORAGE_KEY);
  const parsed = parseGridThumbnailBadge(stored);
  return parsed ?? defaultGridThumbnailBadge(bootMode);
}

export function storeGridThumbnailBadge(enabled: boolean): void {
  window.localStorage.setItem(GRID_THUMBNAIL_BADGE_STORAGE_KEY, enabled ? "true" : "false");
}
