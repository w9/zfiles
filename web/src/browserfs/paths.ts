/**
 * Browser filesystem paths use the same shape as the other backends: relative to the
 * volume root, "/"-separated, with no leading or trailing slash. The root is "".
 */

const INVALID_NAME_PATTERN = /[/\\\u0000]/;

export function normalizePath(path: string): string {
  return path.split("/").filter(Boolean).join("/");
}

export function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function pathParent(path: string): string {
  const segments = pathSegments(path);
  segments.pop();
  return segments.join("/");
}

export function pathName(path: string): string {
  const segments = pathSegments(path);
  return segments.length > 0 ? segments[segments.length - 1] : "";
}

export function joinPath(parent: string, name: string): string {
  return [...pathSegments(parent), ...pathSegments(name)].join("/");
}

/** True when `child` is `ancestor` itself or sits underneath it. The root contains everything. */
export function pathIsWithin(child: string, ancestor: string): boolean {
  const normalizedChild = normalizePath(child);
  const normalizedAncestor = normalizePath(ancestor);
  if (!normalizedAncestor) {
    return true;
  }
  return (
    normalizedChild === normalizedAncestor ||
    normalizedChild.startsWith(`${normalizedAncestor}/`)
  );
}

/** Key prefix that bounds a subtree scan over paths. */
export function descendantPrefix(path: string): string {
  const normalized = normalizePath(path);
  return normalized ? `${normalized}/` : "";
}

export function isValidEntryName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return false;
  }
  return !INVALID_NAME_PATTERN.test(trimmed);
}

export function isValidPath(path: string): boolean {
  return pathSegments(path).every(isValidEntryName);
}
