import { appBasePath, stripAppBasePath, withAppBasePath } from "@/routing/appBase";

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
export function isExplorerPathname(pathname: string, base?: string): boolean {
  const normalized = normalizePathname(stripAppBasePath(pathname, base ?? appBasePath()));
  return (
    normalized === "/" ||
    normalized === EXPLORER_URL_PREFIX ||
    normalized.startsWith(`${EXPLORER_URL_PREFIX}/`)
  );
}

/** Decode an explorer folder path from a URL pathname (may include app base). */
export function explorerPathFromPathname(pathname: string, base?: string): string {
  const normalized = normalizePathname(stripAppBasePath(pathname, base ?? appBasePath()));
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

/** Internal route pathname for an explorer folder path (root → `/`). */
export function explorerRoutePathname(path: string): string {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return "/";
  }
  return `${EXPLORER_URL_PREFIX}/${encodePathSegments(normalized)}`;
}

/** Full pathname for an explorer folder path, including app base when set. */
export function explorerHrefForPath(path: string, base?: string): string {
  return withAppBasePath(explorerRoutePathname(path), base ?? appBasePath());
}

/** Full href for history updates, preserving the current query string and hash. */
export function explorerHistoryHrefForPath(path: string): string {
  const url = new URL(window.location.href);
  url.pathname = explorerHrefForPath(path);
  return `${url.pathname}${url.search}${url.hash}`;
}
