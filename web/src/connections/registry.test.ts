import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_CONNECTION_ID,
  ConnectionRegistry,
  CONNECTIONS_STORAGE_KEY,
} from "./registry";
import {
  S3_CONNECTION_SETTINGS_STORAGE_KEY,
  S3_SESSION_STORAGE_KEY,
  type S3ConnectionSettings,
} from "../cloud/types";

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.entries.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

const SETTINGS: S3ConnectionSettings = {
  provider: "r2",
  bucket: "my-data",
  region: "auto",
  endpoint: "https://account.r2.cloudflarestorage.com",
  prefix: "",
  readOnly: false,
};

const CREDENTIALS = { accessKeyId: "AKIA", secretAccessKey: "secret" };

function createRegistry() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  let counter = 0;
  const registry = new ConnectionRegistry({
    local,
    session,
    createId: () => `id-${(counter += 1)}`,
    now: () => 1_700_000_000_000,
  });
  return { registry, local, session };
}

test("the browser connection is pinned first and cannot be removed", () => {
  const { registry } = createRegistry();

  const [first] = registry.list();
  assert.equal(first.id, BROWSER_CONNECTION_ID);
  assert.equal(first.kind, "browser");
  assert.equal(registry.list().length, 1);

  registry.remove(BROWSER_CONNECTION_ID);
  assert.equal(registry.list()[0].id, BROWSER_CONNECTION_ID);
});

test("create stores an s3 connection after the pinned browser entry", () => {
  const { registry, local } = createRegistry();

  const record = registry.create({ settings: SETTINGS });

  assert.equal(record.id, "id-1");
  assert.equal(record.kind, "s3");
  assert.equal(record.name, "my-data");
  assert.equal(record.rememberKeys, false);
  assert.deepEqual(
    registry.list().map((entry) => entry.id),
    [BROWSER_CONNECTION_ID, "id-1"],
  );
  assert.ok(local.getItem(CONNECTIONS_STORAGE_KEY)?.includes("my-data"));
});

test("create keeps names unique", () => {
  const { registry } = createRegistry();

  registry.create({ settings: SETTINGS });
  const second = registry.create({ settings: SETTINGS });
  const named = registry.create({ name: "Photos", settings: SETTINGS });

  assert.equal(second.name, "my-data 2");
  assert.equal(named.name, "Photos");
});

test("remembered keys persist while session keys stay out of storage", () => {
  const { registry, local } = createRegistry();

  const remembered = registry.create({
    settings: SETTINGS,
    credentials: CREDENTIALS,
    rememberKeys: true,
  });
  const sessionOnly = registry.create({
    name: "Session",
    settings: SETTINGS,
    credentials: CREDENTIALS,
  });

  assert.deepEqual(registry.credentials(remembered.id), CREDENTIALS);
  assert.deepEqual(registry.credentials(sessionOnly.id), CREDENTIALS);

  assert.ok(registry.hasStoredCredentials(remembered.id));
  assert.equal(registry.hasStoredCredentials(sessionOnly.id), false);
  assert.equal(local.getItem(CONNECTIONS_STORAGE_KEY)?.includes("secret"), false);
});

test("credentials survive a reload only when they were remembered", () => {
  const { registry, local, session } = createRegistry();
  const remembered = registry.create({
    settings: SETTINGS,
    credentials: CREDENTIALS,
    rememberKeys: true,
  });
  const sessionOnly = registry.create({
    name: "Session",
    settings: SETTINGS,
    credentials: CREDENTIALS,
  });

  const reloaded = new ConnectionRegistry({ local, session });

  assert.deepEqual(reloaded.credentials(remembered.id), CREDENTIALS);
  assert.equal(reloaded.credentials(sessionOnly.id), null);
});

test("update renames, re-scopes settings, and can stop remembering keys", () => {
  const { registry } = createRegistry();
  registry.create({ name: "Taken", settings: SETTINGS });
  const record = registry.create({
    settings: SETTINGS,
    credentials: CREDENTIALS,
    rememberKeys: true,
  });

  const renamed = registry.update(record.id, { name: "Taken" });
  assert.equal(renamed.name, "Taken 2");

  const rescoped = registry.update(record.id, {
    settings: { ...SETTINGS, prefix: "photos/" },
  });
  assert.equal(rescoped.settings?.prefix, "photos/");

  registry.update(record.id, { rememberKeys: false });
  assert.equal(registry.hasStoredCredentials(record.id), false);
  assert.deepEqual(registry.credentials(record.id), CREDENTIALS);
});

test("duplicate copies settings and remembered keys under a new name", () => {
  const { registry } = createRegistry();
  const record = registry.create({
    settings: SETTINGS,
    credentials: CREDENTIALS,
    rememberKeys: true,
  });

  const copy = registry.duplicate(record.id);

  assert.notEqual(copy.id, record.id);
  assert.equal(copy.name, "my-data 2");
  assert.deepEqual(copy.settings, record.settings);
  assert.deepEqual(registry.credentials(copy.id), CREDENTIALS);
});

test("forgetCredentials clears stored and in-session keys", () => {
  const { registry } = createRegistry();
  const record = registry.create({
    settings: SETTINGS,
    credentials: CREDENTIALS,
    rememberKeys: true,
  });

  registry.forgetCredentials(record.id);

  assert.equal(registry.credentials(record.id), null);
  assert.equal(registry.hasStoredCredentials(record.id), false);
  assert.equal(registry.get(record.id)?.rememberKeys, false);
});

test("dropCredentials clears keys but keeps the remember preference", () => {
  const { registry } = createRegistry();
  const record = registry.create({
    settings: SETTINGS,
    credentials: CREDENTIALS,
    rememberKeys: true,
  });

  registry.dropCredentials(record.id);

  assert.equal(registry.credentials(record.id), null);
  assert.equal(registry.get(record.id)?.rememberKeys, true);
});

test("remove deletes the record, its keys, and resets the active connection", () => {
  const { registry } = createRegistry();
  const record = registry.create({
    settings: SETTINGS,
    credentials: CREDENTIALS,
    rememberKeys: true,
  });
  registry.setActive(record.id);

  registry.remove(record.id);

  assert.equal(registry.get(record.id), null);
  assert.equal(registry.credentials(record.id), null);
  assert.equal(registry.activeId(), BROWSER_CONNECTION_ID);
});

test("the active connection is remembered and falls back to browser storage", () => {
  const { registry, local, session } = createRegistry();
  const record = registry.create({ settings: SETTINGS });

  registry.setActive(record.id);
  assert.equal(new ConnectionRegistry({ local, session }).activeId(), record.id);

  registry.setActive("missing");
  assert.equal(registry.activeId(), BROWSER_CONNECTION_ID);
});

test("legacy session credentials migrate into a saved connection", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  session.setItem(
    S3_SESSION_STORAGE_KEY,
    JSON.stringify({ ...SETTINGS, credentials: CREDENTIALS }),
  );
  session.setItem(S3_CONNECTION_SETTINGS_STORAGE_KEY, JSON.stringify(SETTINGS));

  const registry = new ConnectionRegistry({ local, session });
  const migrated = registry.list().filter((entry) => entry.kind === "s3");

  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].name, "my-data");
  assert.equal(migrated[0].rememberKeys, false);
  assert.deepEqual(registry.credentials(migrated[0].id), CREDENTIALS);
  assert.equal(registry.activeId(), migrated[0].id);
  assert.equal(session.getItem(S3_SESSION_STORAGE_KEY), null);
  assert.equal(session.getItem(S3_CONNECTION_SETTINGS_STORAGE_KEY), null);
});

test("corrupted storage is treated as an empty registry", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  local.setItem(CONNECTIONS_STORAGE_KEY, "{not json");

  const registry = new ConnectionRegistry({ local, session });

  assert.deepEqual(
    registry.list().map((entry) => entry.id),
    [BROWSER_CONNECTION_ID],
  );
  assert.equal(registry.activeId(), BROWSER_CONNECTION_ID);
});
