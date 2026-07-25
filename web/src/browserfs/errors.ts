import type { MessageKey } from "../i18n/locales/en";
import { isQuotaExceededError } from "./quota";

export type BrowserFsErrorCode =
  | "not-found"
  | "already-exists"
  | "invalid-name"
  | "into-descendant"
  | "quota-exceeded"
  | "unavailable";

const MESSAGE_KEYS: Record<BrowserFsErrorCode, MessageKey> = {
  "not-found": "browserfs.error.notFound",
  "already-exists": "browserfs.error.alreadyExists",
  "invalid-name": "browserfs.error.invalidName",
  "into-descendant": "browserfs.error.intoDescendant",
  "quota-exceeded": "browserfs.error.quotaExceeded",
  unavailable: "browserfs.error.unavailable",
};

export class BrowserFsError extends Error {
  readonly code: BrowserFsErrorCode;

  constructor(code: BrowserFsErrorCode, message?: string) {
    super(message ?? code);
    this.name = "BrowserFsError";
    this.code = code;
  }
}

export function isBrowserFsError(
  err: unknown,
  code?: BrowserFsErrorCode,
): err is BrowserFsError {
  if (!(err instanceof BrowserFsError)) {
    return false;
  }
  return code == null || err.code === code;
}

/** Wrap raw IndexedDB failures so callers only ever see a coded error. */
export function toBrowserFsError(err: unknown): BrowserFsError {
  if (err instanceof BrowserFsError) {
    return err;
  }
  if (isQuotaExceededError(err)) {
    return new BrowserFsError("quota-exceeded", "browser storage quota exceeded");
  }
  const message = err instanceof Error ? err.message : String(err);
  return new BrowserFsError("unavailable", `browser storage failed: ${message}`);
}

export function browserFsErrorMessageKey(err: unknown): MessageKey | null {
  return isBrowserFsError(err) ? MESSAGE_KEYS[err.code] : null;
}
