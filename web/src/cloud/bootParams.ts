import type { S3BootParams, S3Provider } from "./types";

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
  };
}

export function readBootParamsFromUrl(url: URL = new URL(window.location.href)): S3BootParams {
  return readBootParamsFromSearch(url.search);
}

export function detectBootMode(): "local" | "cloud" {
  const mode = import.meta.env?.VITE_BOOT_MODE;
  return mode === "cloud" ? "cloud" : "local";
}
