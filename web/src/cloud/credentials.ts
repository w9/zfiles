import type { S3ConnectionConfig } from "./types";
import { S3_SESSION_STORAGE_KEY } from "./types";

export function loadSessionConfig(): S3ConnectionConfig | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(S3_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as S3ConnectionConfig;
  } catch {
    return null;
  }
}

export function saveSessionConfig(config: S3ConnectionConfig): void {
  window.sessionStorage.setItem(S3_SESSION_STORAGE_KEY, JSON.stringify(config));
}

export function clearSessionConfig(): void {
  window.sessionStorage.removeItem(S3_SESSION_STORAGE_KEY);
}
