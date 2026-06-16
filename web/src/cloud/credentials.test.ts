import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  clearPreservedConnectionSettings,
  clearSessionConfig,
  clearSessionCredentialsPreservingSettings,
  loadPreservedConnectionSettings,
  loadSessionConfig,
  saveSessionConfig,
} from "./credentials";
import {
  type S3ConnectionConfig,
} from "./types";

const storage = new Map<string, string>();
const sessionStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};

const config: S3ConnectionConfig = {
  provider: "r2",
  bucket: "photos",
  region: "auto",
  endpoint: "https://example.r2.cloudflarestorage.com",
  prefix: "albums/",
  readOnly: false,
  credentials: {
    accessKeyId: "key",
    secretAccessKey: "secret",
    sessionToken: "token",
  },
};

afterEach(() => {
  storage.clear();
});

test("clearSessionCredentialsPreservingSettings removes secrets and keeps connection settings", () => {
  globalThis.window = { sessionStorage } as unknown as Window & typeof globalThis;
  saveSessionConfig(config);

  const preserved = clearSessionCredentialsPreservingSettings(config);

  assert.equal(loadSessionConfig(), null);
  assert.deepEqual(preserved, {
    provider: "r2",
    bucket: "photos",
    region: "auto",
    endpoint: "https://example.r2.cloudflarestorage.com",
    prefix: "albums/",
    readOnly: false,
  });
  assert.deepEqual(loadPreservedConnectionSettings(), preserved);
});

test("clearSessionConfig removes both active and preserved cloud settings", () => {
  globalThis.window = { sessionStorage } as unknown as Window & typeof globalThis;
  saveSessionConfig(config);
  clearSessionCredentialsPreservingSettings(config);

  clearSessionConfig();

  assert.equal(loadSessionConfig(), null);
  assert.equal(loadPreservedConnectionSettings(), null);
});

test("clearPreservedConnectionSettings keeps active credentials", () => {
  globalThis.window = { sessionStorage } as unknown as Window & typeof globalThis;
  saveSessionConfig(config);
  clearSessionCredentialsPreservingSettings(config);
  saveSessionConfig(config);

  clearPreservedConnectionSettings();

  assert.deepEqual(loadSessionConfig(), config);
  assert.equal(loadPreservedConnectionSettings(), null);
});
