import { formatModifiedDisplay } from "@/listing-format";
import type { ModifiedTimeFormat } from "@/settings/modifiedTimeFormat";
import { parentExplorerPath } from "@/explorer/path";

const EXTENSION_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".xml": "application/xml",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".zip": "application/zip",
};

export function fileExtension(path: string): string | null {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  return name.slice(dot).toLowerCase();
}

function mimeFromExtension(extension: string | null): string | null {
  if (!extension) {
    return null;
  }
  return EXTENSION_MIME[extension] ?? null;
}

export type KindLabelInput = {
  isDir: boolean;
  path: string;
  contentType?: string | null;
  labels: {
    folder: string;
    noExtension: string;
  };
};

export function formatKindLabel(input: KindLabelInput): string {
  if (input.isDir) {
    return input.labels.folder;
  }

  const extension = fileExtension(input.path);
  const mime =
    input.contentType?.trim() || mimeFromExtension(extension) || null;

  if (!extension) {
    return input.labels.noExtension;
  }
  if (mime) {
    return `${mime} (${extension})`;
  }
  return `(${extension})`;
}

export function formatPreviewModified(
  value: unknown,
  locale: string,
  format: ModifiedTimeFormat,
): string {
  if (value == null) {
    return "—";
  }
  return formatModifiedDisplay(value, locale, format);
}

export function resolveSymlinkTarget(
  symlinkPath: string,
  target: string,
): { resolvedPath: string | null; inRoot: boolean } {
  if (target.startsWith("/")) {
    return { resolvedPath: null, inRoot: false };
  }

  const parent = parentExplorerPath(symlinkPath);
  const stack = parent.split("/").filter(Boolean);
  for (const part of target.split("/").filter(Boolean)) {
    if (part === ".") {
      continue;
    }
    if (part === "..") {
      if (stack.length === 0) {
        return { resolvedPath: null, inRoot: false };
      }
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return { resolvedPath: stack.join("/"), inRoot: true };
}

export function countDirectoryChildren(
  entries: Array<{ is_dir: boolean }>,
): { files: number; folders: number } {
  let files = 0;
  let folders = 0;
  for (const entry of entries) {
    if (entry.is_dir) {
      folders += 1;
    } else {
      files += 1;
    }
  }
  return { files, folders };
}

export function cloudExtraString(
  extra: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = extra?.[key];
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value;
}
