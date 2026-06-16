const S3_AUTH_ERROR_CODES = new Set([
  "AccessDenied",
  "CredentialsProviderError",
  "ExpiredToken",
  "InvalidAccessKeyId",
  "InvalidClientTokenId",
  "InvalidSecurity",
  "InvalidToken",
  "NotSignedUp",
  "RequestTimeTooSkewed",
  "SignatureDoesNotMatch",
  "TokenRefreshRequired",
  "Unauthorized",
  "UnauthorizedOperation",
]);

type AuthErrorOptions = {
  cause: unknown;
  code?: string;
  statusCode?: number;
};

export class CloudCredentialsAuthError extends Error {
  readonly cause: unknown;
  readonly code?: string;
  readonly statusCode?: number;

  constructor(message: string, options: AuthErrorOptions) {
    super(message);
    this.name = "CloudCredentialsAuthError";
    this.cause = options.cause;
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function readStatusCode(value: unknown): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const metadata = (value as Record<string, unknown>).$metadata;
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const raw = (metadata as Record<string, unknown>).httpStatusCode;
  return typeof raw === "number" ? raw : undefined;
}

const XHR_HTTP_HANDLER_ERROR = "XHR_HTTP_HANDLER_ERROR";

/** Browser blocked the S3 response (common when R2/S3 returns 403 without CORS headers). */
function isS3BrowserTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.message.includes(XHR_HTTP_HANDLER_ERROR)) {
    return true;
  }
  if (error.name === "TypeError" && /failed to fetch/i.test(error.message)) {
    return true;
  }
  return error.name === "NetworkingError";
}

export function toCloudCredentialsAuthError(
  error: unknown,
): CloudCredentialsAuthError | null {
  if (error instanceof CloudCredentialsAuthError) {
    return error;
  }

  const statusCode = readStatusCode(error);
  const code =
    readStringProperty(error, "name") ??
    readStringProperty(error, "Code") ??
    readStringProperty(error, "code");
  const transportError = isS3BrowserTransportError(error);
  if (transportError) {
    return new CloudCredentialsAuthError(
      "Cloud storage credentials expired or no longer have access.",
      {
        cause: error,
        code: "NetworkError",
      },
    );
  }
  if (!code && statusCode !== 401 && statusCode !== 403) {
    return null;
  }
  if (code && !S3_AUTH_ERROR_CODES.has(code) && statusCode !== 401 && statusCode !== 403) {
    return null;
  }

  return new CloudCredentialsAuthError(
    "Cloud storage credentials expired or no longer have access.",
    {
      cause: error,
      code,
      statusCode,
    },
  );
}

export function isCloudCredentialsAuthError(error: unknown): boolean {
  return error instanceof CloudCredentialsAuthError;
}

const S3_NOT_FOUND_CODES = new Set(["NotFound", "NoSuchKey", "404"]);

/** HeadObject on a missing key — credentials authenticated but the object does not exist. */
export function isS3ObjectNotFoundError(error: unknown): boolean {
  if (readStatusCode(error) === 404) {
    return true;
  }
  const code =
    readStringProperty(error, "name") ??
    readStringProperty(error, "Code") ??
    readStringProperty(error, "code");
  return code != null && S3_NOT_FOUND_CODES.has(code);
}
