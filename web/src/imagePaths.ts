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
  ".svg",
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
  ".svg",
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

const PREVIEW_PDF_EXTENSIONS = [".pdf"];

const PREVIEW_MARKDOWN_EXTENSIONS = [".md", ".markdown"];

const PREVIEW_TEXT_EXTENSIONS = [
  ".txt",
  ".text",
  ".log",
  ".json",
  ".jsonl",
  ".csv",
  ".tsv",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".less",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".kt",
  ".sh",
  ".bash",
  ".zsh",
  ".sql",
  ".graphql",
  ".vue",
  ".svelte",
  ".dockerfile",
  ".env",
  ".gitignore",
  ".editorconfig",
];

// Well-known extensionless text files (matched on lowercased basename).
const PREVIEW_EXTENSIONLESS_TEXT_NAMES = new Set([
  "authors",
  "brewfile",
  "changelog",
  "codeowners",
  "containerfile",
  "contributing",
  "copying",
  "dockerfile",
  "gemfile",
  "gnumakefile",
  "install",
  "jenkinsfile",
  "justfile",
  "licence",
  "license",
  "makefile",
  "notice",
  "procfile",
  "rakefile",
  "readme",
  "todo",
  "vagrantfile",
]);

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "markdown";

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
  const baseName = lower.split("/").pop() ?? lower;
  if (PREVIEW_PDF_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "pdf";
  }
  if (PREVIEW_MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "markdown";
  }
  if (PREVIEW_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "video";
  }
  if (PREVIEW_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "audio";
  }
  if (
    PREVIEW_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
    PREVIEW_EXTENSIONLESS_TEXT_NAMES.has(baseName)
  ) {
    return "text";
  }
  return null;
}

export function isPreviewable(path: string): boolean {
  return previewKind(path) !== null;
}
