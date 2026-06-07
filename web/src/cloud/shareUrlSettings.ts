const SHARE_URL_INCLUDE_CREDENTIALS_KEY = "zfiles-share-url-include-credentials";

export function defaultShareUrlIncludeCredentials(): boolean {
  return true;
}

export function readShareUrlIncludeCredentials(): boolean {
  if (typeof window === "undefined") {
    return defaultShareUrlIncludeCredentials();
  }
  const stored = window.localStorage.getItem(SHARE_URL_INCLUDE_CREDENTIALS_KEY);
  if (stored === "false") {
    return false;
  }
  if (stored === "true") {
    return true;
  }
  return defaultShareUrlIncludeCredentials();
}

export function storeShareUrlIncludeCredentials(include: boolean): void {
  window.localStorage.setItem(
    SHARE_URL_INCLUDE_CREDENTIALS_KEY,
    include ? "true" : "false",
  );
}
