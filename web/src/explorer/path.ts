/** Normalize user input from the breadcrumb address bar into an explorer path. */
export function normalizeExplorerPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.replace(/^\/+|\/+$/g, "");
}
