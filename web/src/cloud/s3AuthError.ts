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
