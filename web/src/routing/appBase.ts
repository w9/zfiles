/**
 * Vite `import.meta.env.BASE_URL` mount prefix (e.g. `/` or `/repo/`).
 * Normalized to a pathname without trailing slash; empty string at site root.
 */
export function normalizeAppBase(baseUrl: string): string {
  if (!baseUrl || baseUrl === "/") {
    return "";
  }
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function appBasePath(): string {
  const baseUrl =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL != null
      ? import.meta.env.BASE_URL
      : "/";
  return normalizeAppBase(baseUrl);
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
}

/** Remove the app mount prefix from a full `location.pathname`. */
export function stripAppBasePath(
  pathname: string,
  base: string = appBasePath(),
): string {
  const normalized = normalizePathname(pathname);
  if (!base) {
    return normalized;
  }
  if (normalized === base) {
    return "/";
  }
  if (normalized.startsWith(`${base}/`)) {
    const rest = normalized.slice(base.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return normalized;
}

/** Apply the app mount prefix to an internal route pathname (`/`, `/settings`, `/f/...`). */
export function withAppBasePath(
  routePathname: string,
  base: string = appBasePath(),
): string {
  const internal = routePathname.startsWith("/") ? routePathname : `/${routePathname}`;
  if (!base) {
    return internal;
  }
  if (internal === "/") {
    return `${base}/`;
  }
  return `${base}${internal}`;
}
