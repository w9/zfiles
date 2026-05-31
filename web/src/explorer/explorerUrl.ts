/** Top-level URL segment that prefixes explorer folder paths. */
export const EXPLORER_URL_PREFIX = "/f";

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
}

function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function decodePathSegments(encoded: string): string {
  return encoded.split("/").map(decodeURIComponent).join("/");
}

/** Whether the pathname is an explorer view (root, `/f`, or `/f/...`). */
export function isExplorerPathname(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return (
    normalized === "/" ||
    normalized === EXPLORER_URL_PREFIX ||
    normalized.startsWith(`${EXPLORER_URL_PREFIX}/`)
  );
}

/** Decode an explorer folder path from a URL pathname. */
export function explorerPathFromPathname(pathname: string): string {
  const normalized = normalizePathname(pathname);
  if (normalized === "/" || normalized === EXPLORER_URL_PREFIX) {
    return "";
  }
  if (!normalized.startsWith(`${EXPLORER_URL_PREFIX}/`)) {
    return "";
  }
  const encoded = normalized.slice(`${EXPLORER_URL_PREFIX}/`.length);
  if (!encoded) {
    return "";
  }
  return decodePathSegments(encoded);
}

/** Canonical pathname for an explorer folder path (root → `/`). */
export function explorerHrefForPath(path: string): string {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return "/";
  }
  return `${EXPLORER_URL_PREFIX}/${encodePathSegments(normalized)}`;
}

/** Full href for history updates, preserving the current query string and hash. */
export function explorerHistoryHrefForPath(path: string): string {
  const url = new URL(window.location.href);
  url.pathname = explorerHrefForPath(path);
  return `${url.pathname}${url.search}${url.hash}`;
}
