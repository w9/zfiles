const bearerToken = new URLSearchParams(window.location.search).get("token");

export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  return fetch(input, { ...init, headers });
}

export function websocketUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(path, `${protocol}//${window.location.host}`);
  if (bearerToken) {
    url.searchParams.set("token", bearerToken);
  }
  return url.toString();
}
