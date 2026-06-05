export type PasteBatchOnError = "stop" | "continue";

export const PASTE_BATCH_ON_ERROR_STORAGE_KEY = "zfiles-paste-batch-on-error";

export const DEFAULT_PASTE_BATCH_ON_ERROR: PasteBatchOnError = "stop";

export function parsePasteBatchOnError(value: string | null): PasteBatchOnError {
  if (value === "continue") {
    return "continue";
  }
  return DEFAULT_PASTE_BATCH_ON_ERROR;
}

export function readStoredPasteBatchOnError(): PasteBatchOnError {
  if (typeof window === "undefined") {
    return DEFAULT_PASTE_BATCH_ON_ERROR;
  }
  return parsePasteBatchOnError(
    window.localStorage.getItem(PASTE_BATCH_ON_ERROR_STORAGE_KEY),
  );
}

export function storePasteBatchOnError(value: PasteBatchOnError): void {
  window.localStorage.setItem(PASTE_BATCH_ON_ERROR_STORAGE_KEY, value);
}
