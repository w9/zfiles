import type { S3Provider } from "@/cloud/types";

export const UPLOAD_CHECKSUM_VALIDATION_STORAGE_KEY =
  "zfiles-upload-checksum-validation";

export function defaultUploadChecksumValidation(): boolean {
  return true;
}

export function parseUploadChecksumValidation(value: string | null): boolean | null {
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return null;
}

export function readUploadChecksumValidation(): boolean {
  if (typeof window === "undefined") {
    return defaultUploadChecksumValidation();
  }
  const stored = window.localStorage.getItem(UPLOAD_CHECKSUM_VALIDATION_STORAGE_KEY);
  const parsed = parseUploadChecksumValidation(stored);
  return parsed ?? defaultUploadChecksumValidation();
}

export function storeUploadChecksumValidation(enabled: boolean): void {
  window.localStorage.setItem(
    UPLOAD_CHECKSUM_VALIDATION_STORAGE_KEY,
    enabled ? "true" : "false",
  );
}

/** R2 never uses checksum validation; AWS honors the user setting. */
export function uploadChecksumValidationEnabled(
  provider: S3Provider,
  settingEnabled: boolean,
): boolean {
  if (provider === "r2") {
    return false;
  }
  return settingEnabled;
}
