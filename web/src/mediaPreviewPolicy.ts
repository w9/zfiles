import { isBrowserPreviewImage, isBrowserPreviewVideo } from "@/imagePaths";

export type EntryMediaPreviewSurface = "grid" | "list";

export function canEntryMediaPreviewImage(
  name: string,
  isDir: boolean,
  previewsEnabled: boolean,
): boolean {
  return previewsEnabled && !isDir && isBrowserPreviewImage(name);
}

export function canEntryMediaPreviewVideo(
  name: string,
  isDir: boolean,
  previewsEnabled: boolean,
): boolean {
  return previewsEnabled && !isDir && isBrowserPreviewVideo(name);
}

export type EntryMediaVideoChrome = {
  showPlay: boolean;
  showDuration: boolean;
};

/** Video overlay chrome: list is play-only; grid may also show duration. */
export function entryMediaVideoChrome(
  surface: EntryMediaPreviewSurface,
  options: {
    badgeEnabled: boolean;
    showVideoPreview: boolean;
    loaded: boolean;
    failed: boolean;
  },
): EntryMediaVideoChrome {
  const active =
    options.badgeEnabled &&
    options.showVideoPreview &&
    options.loaded &&
    !options.failed;
  if (!active) {
    return { showPlay: false, showDuration: false };
  }
  if (surface === "list") {
    return { showPlay: true, showDuration: false };
  }
  return { showPlay: true, showDuration: true };
}
