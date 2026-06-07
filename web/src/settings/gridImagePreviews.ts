export const GRID_IMAGE_PREVIEWS_STORAGE_KEY = "zfiles-grid-image-previews";

export type BootMode = "local" | "cloud";

export function defaultGridImagePreviews(_bootMode: BootMode): boolean {
  return true;
}

export function parseGridImagePreviews(value: string | null): boolean | null {
  if (value === "1" || value === "true") {
    return true;
  }
  if (value === "0" || value === "false") {
    return false;
  }
  return null;
}

export function readStoredGridImagePreviews(bootMode: BootMode): boolean {
  if (typeof window === "undefined") {
    return defaultGridImagePreviews(bootMode);
  }
  const stored = window.localStorage.getItem(GRID_IMAGE_PREVIEWS_STORAGE_KEY);
  const parsed = parseGridImagePreviews(stored);
  return parsed ?? defaultGridImagePreviews(bootMode);
}

export function storeGridImagePreviews(enabled: boolean): void {
  window.localStorage.setItem(GRID_IMAGE_PREVIEWS_STORAGE_KEY, enabled ? "true" : "false");
}
