import type { S3ConnectionConfig, S3ConnectionSettings } from "./types";
import {
  S3_CONNECTION_SETTINGS_STORAGE_KEY,
  S3_SESSION_STORAGE_KEY,
} from "./types";

function settingsFromConfig(config: S3ConnectionConfig): S3ConnectionSettings {
  return {
    provider: config.provider,
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    prefix: config.prefix,
    readOnly: config.readOnly,
  };
}

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
  clearPreservedConnectionSettings();
}

export function clearSessionConfig(): void {
  window.sessionStorage.removeItem(S3_SESSION_STORAGE_KEY);
  clearPreservedConnectionSettings();
}

export function loadPreservedConnectionSettings(): S3ConnectionSettings | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(S3_CONNECTION_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as S3ConnectionSettings;
  } catch {
    return null;
  }
}

export function clearPreservedConnectionSettings(): void {
  window.sessionStorage.removeItem(S3_CONNECTION_SETTINGS_STORAGE_KEY);
}

export function clearSessionCredentialsPreservingSettings(
  config: S3ConnectionConfig,
): S3ConnectionSettings {
  const settings = settingsFromConfig(config);
  window.sessionStorage.setItem(
    S3_CONNECTION_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );
  window.sessionStorage.removeItem(S3_SESSION_STORAGE_KEY);
  return settings;
}
