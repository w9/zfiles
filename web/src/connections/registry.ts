import {
  S3_CONNECTION_SETTINGS_STORAGE_KEY,
  S3_SESSION_STORAGE_KEY,
  type S3ConnectionConfig,
  type S3ConnectionSettings,
  type S3Credentials,
} from "../cloud/types";
import { suggestConnectionName, uniqueConnectionName } from "./naming";
import type {
  ConnectionRecord,
  CreateConnectionInput,
  UpdateConnectionInput,
} from "./types";

export const CONNECTIONS_STORAGE_KEY = "zfiles-connections";
export const ACTIVE_CONNECTION_STORAGE_KEY = "zfiles-active-connection";
export const CONNECTION_KEYS_STORAGE_KEY = "zfiles-connection-keys";
export const BROWSER_CONNECTION_ID = "browser";
export const KERNEL_CONNECTION_ID = "kernel";

/** Storage subset we need; `localStorage` and `sessionStorage` both satisfy it. */
export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type ConnectionRegistryOptions = {
  local?: KeyValueStore;
  session?: KeyValueStore;
  createId?: () => string;
  now?: () => number;
};

type StoredConnections = {
  version: number;
  connections: ConnectionRecord[];
};

const STORAGE_VERSION = 1;

function memoryStore(): KeyValueStore {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/** Private browsing and disabled storage both throw on access, so fall back to memory. */
function windowStore(pick: () => Storage): KeyValueStore {
  if (typeof window === "undefined") {
    return memoryStore();
  }
  try {
    const storage = pick();
    const probe = "zfiles-storage-probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return memoryStore();
  }
}

function readJson<T>(store: KeyValueStore, key: string): T | null {
  const raw = store.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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

export function browserConnection(): ConnectionRecord {
  return {
    id: BROWSER_CONNECTION_ID,
    kind: "browser",
    name: "Browser storage",
    createdAt: 0,
    rememberKeys: false,
  };
}

export function kernelConnection(): ConnectionRecord {
  return {
    id: KERNEL_CONNECTION_ID,
    kind: "kernel",
    name: "zfiles server",
    createdAt: 0,
    rememberKeys: false,
  };
}

/**
 * The saved list of volumes. Settings are persisted; access keys only when the user opted
 * in per connection, otherwise they live in memory for the lifetime of the tab.
 */
export class ConnectionRegistry {
  private readonly local: KeyValueStore;
  private readonly session: KeyValueStore;
  private readonly createId: () => string;
  private readonly now: () => number;
  private readonly sessionKeys = new Map<string, S3Credentials>();
  private records: ConnectionRecord[];

  constructor(options: ConnectionRegistryOptions = {}) {
    this.local = options.local ?? windowStore(() => window.localStorage);
    this.session = options.session ?? windowStore(() => window.sessionStorage);
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => Date.now());
    this.records = readJson<StoredConnections>(this.local, CONNECTIONS_STORAGE_KEY)
      ?.connections?.filter((record) => record?.id && record.kind === "s3") ?? [];
    this.migrateLegacySession();
  }

  list(): ConnectionRecord[] {
    return [browserConnection(), ...this.records.map((record) => ({ ...record }))];
  }

  get(id: string): ConnectionRecord | null {
    if (id === BROWSER_CONNECTION_ID) {
      return browserConnection();
    }
    const record = this.records.find((entry) => entry.id === id);
    return record ? { ...record } : null;
  }

  findByName(name: string): ConnectionRecord | null {
    const wanted = name.trim().toLowerCase();
    return this.list().find((entry) => entry.name.toLowerCase() === wanted) ?? null;
  }

  create(input: CreateConnectionInput): ConnectionRecord {
    const record: ConnectionRecord = {
      id: this.createId(),
      kind: "s3",
      name: uniqueConnectionName(
        input.name ?? suggestConnectionName(input.settings),
        this.takenNames(),
      ),
      createdAt: this.now(),
      rememberKeys: input.rememberKeys ?? false,
      settings: { ...input.settings },
    };
    this.records = [...this.records, record];
    this.persistRecords();
    if (input.credentials) {
      this.saveCredentials(record.id, input.credentials, record.rememberKeys);
    }
    return { ...record };
  }

  update(id: string, changes: UpdateConnectionInput): ConnectionRecord {
    const index = this.records.findIndex((entry) => entry.id === id);
    if (index < 0) {
      throw new Error(`unknown connection: ${id}`);
    }
    const next: ConnectionRecord = { ...this.records[index] };
    if (changes.name !== undefined) {
      next.name = uniqueConnectionName(changes.name, this.takenNames(id));
    }
    if (changes.settings) {
      next.settings = { ...changes.settings };
    }
    if (changes.rememberKeys !== undefined) {
      next.rememberKeys = changes.rememberKeys;
    }
    this.records = this.records.map((entry) => (entry.id === id ? next : entry));
    this.persistRecords();

    if (changes.credentials) {
      this.saveCredentials(id, changes.credentials, next.rememberKeys);
    } else if (changes.rememberKeys !== undefined) {
      this.reconcileCredentialStorage(id, next.rememberKeys);
    }
    return { ...next };
  }

  duplicate(id: string): ConnectionRecord {
    const source = this.records.find((entry) => entry.id === id);
    if (!source?.settings) {
      throw new Error(`unknown connection: ${id}`);
    }
    return this.create({
      name: source.name,
      settings: source.settings,
      credentials: this.credentials(id) ?? undefined,
      rememberKeys: source.rememberKeys,
    });
  }

  remove(id: string): void {
    if (id === BROWSER_CONNECTION_ID) {
      return;
    }
    this.records = this.records.filter((entry) => entry.id !== id);
    this.persistRecords();
    this.forgetCredentials(id);
    if (this.local.getItem(ACTIVE_CONNECTION_STORAGE_KEY) === id) {
      this.setActive(BROWSER_CONNECTION_ID);
    }
  }

  activeId(): string {
    const stored = this.local.getItem(ACTIVE_CONNECTION_STORAGE_KEY);
    if (stored && this.get(stored)) {
      return stored;
    }
    return BROWSER_CONNECTION_ID;
  }

  setActive(id: string): void {
    this.local.setItem(ACTIVE_CONNECTION_STORAGE_KEY, id);
    const index = this.records.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      this.records = this.records.map((entry) =>
        entry.id === id ? { ...entry, lastUsedAt: this.now() } : entry,
      );
      this.persistRecords();
    }
  }

  credentials(id: string): S3Credentials | null {
    return this.sessionKeys.get(id) ?? this.storedCredentials()[id] ?? null;
  }

  hasStoredCredentials(id: string): boolean {
    return this.storedCredentials()[id] != null;
  }

  saveCredentials(id: string, credentials: S3Credentials, remember: boolean): void {
    this.sessionKeys.set(id, credentials);
    const stored = this.storedCredentials();
    if (remember) {
      stored[id] = credentials;
    } else {
      delete stored[id];
    }
    this.persistCredentials(stored);
  }

  /** Drop keys after a rejected request without changing what the user asked us to remember. */
  dropCredentials(id: string): void {
    this.sessionKeys.delete(id);
    const stored = this.storedCredentials();
    if (stored[id]) {
      delete stored[id];
      this.persistCredentials(stored);
    }
  }

  forgetCredentials(id: string): void {
    this.dropCredentials(id);
    const record = this.records.find((entry) => entry.id === id);
    if (record?.rememberKeys) {
      this.records = this.records.map((entry) =>
        entry.id === id ? { ...entry, rememberKeys: false } : entry,
      );
      this.persistRecords();
    }
  }

  private takenNames(excludeId?: string): string[] {
    return this.list()
      .filter((entry) => entry.id !== excludeId)
      .map((entry) => entry.name);
  }

  private reconcileCredentialStorage(id: string, remember: boolean): void {
    const credentials = this.credentials(id);
    if (!credentials) {
      return;
    }
    this.saveCredentials(id, credentials, remember);
  }

  private storedCredentials(): Record<string, S3Credentials> {
    return readJson<Record<string, S3Credentials>>(this.local, CONNECTION_KEYS_STORAGE_KEY) ?? {};
  }

  private persistCredentials(credentials: Record<string, S3Credentials>): void {
    if (Object.keys(credentials).length === 0) {
      this.local.removeItem(CONNECTION_KEYS_STORAGE_KEY);
      return;
    }
    this.local.setItem(CONNECTION_KEYS_STORAGE_KEY, JSON.stringify(credentials));
  }

  private persistRecords(): void {
    const payload: StoredConnections = {
      version: STORAGE_VERSION,
      connections: this.records,
    };
    this.local.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(payload));
  }

  /** Adopt the pre-registry `sessionStorage` connection so a reload keeps working. */
  private migrateLegacySession(): void {
    const legacyConfig = readJson<S3ConnectionConfig>(this.session, S3_SESSION_STORAGE_KEY);
    const legacySettings = readJson<S3ConnectionSettings>(
      this.session,
      S3_CONNECTION_SETTINGS_STORAGE_KEY,
    );
    if (!legacyConfig && !legacySettings) {
      return;
    }
    const settings = legacyConfig ? settingsFromConfig(legacyConfig) : legacySettings;
    if (settings && this.records.length === 0) {
      const record = this.create({
        settings,
        credentials: legacyConfig?.credentials,
        rememberKeys: false,
      });
      this.setActive(record.id);
    }
    this.session.removeItem(S3_SESSION_STORAGE_KEY);
    this.session.removeItem(S3_CONNECTION_SETTINGS_STORAGE_KEY);
  }
}

export function createConnectionRegistry(
  options?: ConnectionRegistryOptions,
): ConnectionRegistry {
  return new ConnectionRegistry(options);
}
