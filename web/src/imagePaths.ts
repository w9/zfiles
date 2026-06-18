const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".tiff",
  ".tif",
  ".bmp",
  ".ico",
  ".heic",
  ".heif",
  ".nef",
  ".cr2",
  ".arw",
  ".dng",
  ".orf",
  ".rw2",
];

const BROWSER_PREVIEW_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".ico",
];

const BROWSER_PREVIEW_VIDEO_EXTENSIONS = [".mp4", ".webm"];

// Types the browser can play natively from a download URL, no kernel
// transcoding. Image detection reuses IMAGE_EXTENSIONS (incl. RAW, which
// won't decode but stays in the set for parity with prior slideshow scope).
const PREVIEW_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv"];

const PREVIEW_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".flac",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
];

export type PreviewKind = "image" | "video" | "audio";

export function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isBrowserPreviewImage(path: string): boolean {
  const lower = path.toLowerCase();
  return BROWSER_PREVIEW_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isBrowserPreviewVideo(path: string): boolean {
  const lower = path.toLowerCase();
  return BROWSER_PREVIEW_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function previewKind(path: string): PreviewKind | null {
  if (isImagePath(path)) {
    return "image";
  }
  const lower = path.toLowerCase();
  if (PREVIEW_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "video";
  }
  if (PREVIEW_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "audio";
  }
  return null;
}

export function isPreviewable(path: string): boolean {
  return previewKind(path) !== null;
}
