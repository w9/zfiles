import type { S3BootParams, S3Provider } from "./types";
import { S3_CREDENTIAL_URL_PARAM_NAMES } from "./types";

function firstParam(params: URLSearchParams, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key);
    if (value != null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function parseProvider(value: string | null): S3Provider | undefined {
  if (value === "aws" || value === "r2") {
    return value;
  }
  return undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  if (value === "1" || value === "true" || value === "yes") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no") {
    return false;
  }
  return undefined;
}

export function readBootParamsFromSearch(search: string): S3BootParams {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    provider: parseProvider(params.get("provider")),
    bucket: params.get("bucket") ?? undefined,
    region: params.get("region") ?? undefined,
    endpoint: params.get("endpoint") ?? undefined,
    prefix: params.get("prefix") ?? undefined,
    readOnly: parseBoolean(
      params.get("readonly") ?? params.get("read_only") ?? params.get("readOnly"),
    ),
    accessKeyId: firstParam(params, "accessKeyId", "access_key_id"),
    secretAccessKey: firstParam(params, "secretAccessKey", "secret_access_key"),
    sessionToken: firstParam(params, "sessionToken", "session_token"),
  };
}

/**
 * What the URL asks us to connect to. `saved:<name>` activates a stored connection,
 * `new` connects to a bucket described by the other params, and `ask` opens the picker.
 */
export type ConnectIntent =
  | { kind: "saved"; name: string }
  | { kind: "new" }
  | { kind: "ask" };

export type BootRequest = {
  intent: ConnectIntent | null;
  params: S3BootParams;
};

export function parseConnectIntent(value: string | null): ConnectIntent | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "new") {
    return { kind: "new" };
  }
  if (lower === "ask") {
    return { kind: "ask" };
  }
  if (!lower.startsWith("saved:")) {
    return null;
  }
  const raw = trimmed.slice("saved:".length);
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding: fall back to the literal value.
  }
  name = name.trim();
  return name ? { kind: "saved", name } : null;
}

function hashParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}

/**
 * Credentials ride in the fragment because fragments are never sent to the server, so
 * they stay out of host access logs and Referer headers.
 */
export function readCredentialParamsFromHash(hash: string): Partial<S3BootParams> {
  const params = hashParams(hash);
  const credentials: Partial<S3BootParams> = {};
  const accessKeyId = firstParam(params, "accessKeyId", "access_key_id");
  const secretAccessKey = firstParam(params, "secretAccessKey", "secret_access_key");
  const sessionToken = firstParam(params, "sessionToken", "session_token");
  if (accessKeyId) {
    credentials.accessKeyId = accessKeyId;
  }
  if (secretAccessKey) {
    credentials.secretAccessKey = secretAccessKey;
  }
  if (sessionToken) {
    credentials.sessionToken = sessionToken;
  }
  return credentials;
}

export function readBootRequest(search: string, hash: string): BootRequest {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    intent: parseConnectIntent(params.get("connect")),
    params: {
      ...readBootParamsFromSearch(search),
      ...readCredentialParamsFromHash(hash),
    },
  };
}

export function readBootRequestFromUrl(url: URL = new URL(window.location.href)): BootRequest {
  return readBootRequest(url.search, url.hash);
}

function hashCarriesCredentials(hash: string): boolean {
  const params = hashParams(hash);
  return S3_CREDENTIAL_URL_PARAM_NAMES.some((name) => params.has(name));
}

/** Path/query/hash with credentials removed from both the query string and the fragment. */
export function stripBootCredentialsFromSearch(url: URL): string {
  const stripped = new URL(url.href);
  for (const name of S3_CREDENTIAL_URL_PARAM_NAMES) {
    stripped.searchParams.delete(name);
  }
  const hash = hashCarriesCredentials(stripped.hash) ? "" : stripped.hash;
  return `${stripped.pathname}${stripped.search}${hash}`;
}

export function stripBootCredentialsFromUrl(
  url: URL = new URL(window.location.href),
): void {
  const next = stripBootCredentialsFromSearch(url);
  const current = `${url.pathname}${url.search}${url.hash}`;
  if (next !== current) {
    window.history.replaceState(null, "", next);
  }
}

/** Build a path/query/hash string with credential params removed from search. */
export function stripCredentialParamsFromSearch(url: URL): string {
  const stripped = new URL(url.href);
  for (const name of S3_CREDENTIAL_URL_PARAM_NAMES) {
    stripped.searchParams.delete(name);
  }
  return `${stripped.pathname}${stripped.search}${stripped.hash}`;
}

/** Remove credential query params so secrets do not linger in the address bar or history. */
export function stripCredentialParamsFromUrl(url: URL = new URL(window.location.href)): void {
  const next = stripCredentialParamsFromSearch(url);
  const current = `${url.pathname}${url.search}${url.hash}`;
  if (next !== current) {
    window.history.replaceState(null, "", next);
  }
}

export function readBootParamsFromUrl(url: URL = new URL(window.location.href)): S3BootParams {
  return readBootParamsFromSearch(url.search);
}

export function detectBootMode(): "local" | "cloud" {
  const mode = import.meta.env?.VITE_BOOT_MODE;
  return mode === "cloud" ? "cloud" : "local";
}
