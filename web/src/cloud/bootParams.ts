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
    readOnly: parseBoolean(params.get("readonly") ?? params.get("read_only")),
    accessKeyId: firstParam(params, "accessKeyId", "access_key_id"),
    secretAccessKey: firstParam(params, "secretAccessKey", "secret_access_key"),
    sessionToken: firstParam(params, "sessionToken", "session_token"),
  };
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
