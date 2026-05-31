/** Parent directory of an explorer path; root ("") has no parent. */
export function parentExplorerPath(path: string): string {
  if (!path) {
    return "";
  }
  return path.split("/").slice(0, -1).join("/");
}

/** Normalize user input from the breadcrumb address bar into an explorer path. */
export function normalizeExplorerPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.replace(/^\/+|\/+$/g, "");
}
