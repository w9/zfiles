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
