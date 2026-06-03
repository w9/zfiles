/** Build a path/query/hash string with `token` removed from search params. */
export function stripTokenFromUrl(url: URL): string {
  if (!url.searchParams.has("token")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  url.searchParams.delete("token");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Remove one-time `?token=` from the address bar after the server sets the auth cookie. */
export function stripShareTokenFromUrl(): void {
  const url = new URL(window.location.href);
  const next = stripTokenFromUrl(new URL(window.location.href));
  const current = `${url.pathname}${url.search}${url.hash}`;
  if (next !== current) {
    window.history.replaceState(null, "", next);
  }
}

export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, { ...init, credentials: "same-origin" });
}

export function websocketUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new URL(path, `${protocol}//${window.location.host}`).toString();
}
