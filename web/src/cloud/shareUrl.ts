import { explorerHrefForPath } from "@/explorer/explorerUrl";
import type { S3ConnectionConfig, S3Provider } from "./types";

export type ShareUrlInput = {
  provider?: S3Provider;
  bucket?: string;
  region?: string;
  endpoint?: string;
  prefix?: string;
  readOnly?: boolean;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };
};

export type BuildShareUrlOptions = {
  explorerPath?: string;
  includeCredentials?: boolean;
  origin?: string;
  base?: string;
};

function appendParam(params: URLSearchParams, key: string, value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) {
    params.set(key, trimmed);
  }
}

export function connectionConfigToShareInput(config: S3ConnectionConfig): ShareUrlInput {
  return {
    provider: config.provider,
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    prefix: config.prefix,
    readOnly: config.readOnly,
    credentials: config.credentials,
  };
}

export function formToShareInput(form: {
  provider: S3Provider;
  bucket: string;
  region: string;
  endpoint: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  readOnly: boolean;
}): ShareUrlInput {
  return {
    provider: form.provider,
    bucket: form.bucket.trim() || undefined,
    region: form.region.trim() || undefined,
    endpoint: form.endpoint.trim() || undefined,
    prefix: form.prefix.trim() || undefined,
    readOnly: form.readOnly || undefined,
    credentials: {
      accessKeyId: form.accessKeyId.trim() || undefined,
      secretAccessKey: form.secretAccessKey.trim() || undefined,
      sessionToken: form.sessionToken.trim() || undefined,
    },
  };
}

export function buildShareUrl(
  input: ShareUrlInput,
  options: BuildShareUrlOptions = {},
): string {
  const {
    explorerPath = "",
    includeCredentials = true,
    origin = "https://example.com",
    base,
  } = options;
  const params = new URLSearchParams();

  if (input.provider) {
    params.set("provider", input.provider);
  }
  appendParam(params, "bucket", input.bucket);
  appendParam(params, "region", input.region);
  appendParam(params, "endpoint", input.endpoint);
  appendParam(params, "prefix", input.prefix);
  if (input.readOnly) {
    params.set("readOnly", "true");
  }

  if (includeCredentials && input.credentials) {
    appendParam(params, "accessKeyId", input.credentials.accessKeyId);
    appendParam(params, "secretAccessKey", input.credentials.secretAccessKey);
    appendParam(params, "sessionToken", input.credentials.sessionToken);
  }

  const pathname = explorerHrefForPath(explorerPath, base);
  const search = params.toString();
  return `${origin}${pathname}${search ? `?${search}` : ""}`;
}
