import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";

import { createBrowserBackend, type BrowserBackend } from "./browserBackend";
import { BrowserFsStore } from "../browserfs/store";
import { isBrowserFsError } from "../browserfs/errors";
import type { BackendEvent } from "./types";

let databaseCounter = 0;

type Harness = {
  backend: BrowserBackend;
  store: BrowserFsStore;
  createdUrls: string[];
  revokedUrls: string[];
  persistCalls: number;
};

function createHarness(focusTarget: EventTarget | null = null): Harness {
  databaseCounter += 1;
  const store = new BrowserFsStore({
    factory: new IDBFactory(),
    databaseName: `zfiles-browser-backend-test-${databaseCounter}`,
    now: () => Date.UTC(2026, 6, 24, 12, 0, 0),
  });
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  const state = { persistCalls: 0 };
  const backend = createBrowserBackend({
    store,
    focusTarget,
    createObjectURL: () => {
      const url = `blob:test/${createdUrls.length + 1}`;
      createdUrls.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url);
    },
    storage: {
      persisted: () => Promise.resolve(false),
      persist: () => {
        state.persistCalls += 1;
        return Promise.resolve(true);
      },
    },
  });
  return {
    backend,
    store,
    createdUrls,
    revokedUrls,
    get persistCalls() {
      return state.persistCalls;
    },
  };
}

function textFile(name: string, text: string): File {
  return new File([text], name, { type: "text/plain" });
}

test("mode identifies the browser backend", () => {
  const { backend, store } = createHarness();
  assert.equal(backend.mode, "browser");
  store.close();
});

test("list sorts directories before files and maps entries", async () => {
  const { backend, store } = createHarness();
  await store.writeFile("photos/b.txt", new Blob(["bb"]));
  await store.makeDirectory("albums");

  const { entries, nextCursor } = await backend.list("");

  assert.equal(nextCursor, undefined);
  assert.deepEqual(
    entries.map((entry) => [entry.name, entry.is_dir]),
    [
      ["albums", true],
      ["photos", true],
    ],
  );

  const nested = await backend.list("photos");
  assert.equal(nested.entries.length, 1);
  assert.equal(nested.entries[0].path, "photos/b.txt");
  assert.equal(nested.entries[0].size, 2);
  assert.equal(nested.entries[0].modified, new Date(Date.UTC(2026, 6, 24, 12, 0, 0)).toISOString());
  store.close();
});

test("list rejects an unknown directory", async () => {
  const { backend, store } = createHarness();
  await assert.rejects(
    () => backend.list("nope"),
    (err: unknown) => isBrowserFsError(err, "not-found"),
  );
  store.close();
});

test("stat describes the synthetic root and stored files", async () => {
  const { backend, store } = createHarness();
  await store.writeFile("notes.txt", new Blob(["hello"], { type: "text/plain" }));

  const root = await backend.stat("");
  assert.equal(root.is_dir, true);
  assert.equal(root.path, "");

  const file = await backend.stat("notes.txt");
  assert.equal(file.is_dir, false);
  assert.equal(file.size, 5);
  assert.equal(file.extra?.contentType, "text/plain");
  store.close();
});

test("upload stores the file, reports progress, and notifies subscribers", async () => {
  const harness = createHarness();
  const events: BackendEvent[] = [];
  const unsubscribe = harness.backend.subscribe((event) => events.push(event));

  const progress: number[] = [];
  const started: string[] = [];
  await harness.backend.upload(
    textFile("a.txt", "hello"),
    "photos/a.txt",
    (update) => progress.push(update.offset),
    undefined,
    { onUploadStart: () => started.push("start") },
  );

  assert.deepEqual(started, ["start"]);
  assert.equal(progress.at(-1), 5);
  assert.equal(await (await harness.store.readBlob("photos/a.txt")).text(), "hello");

  assert.equal(events[0].type, "connected");
  assert.deepEqual(
    events.filter((event) => event.type === "filesystem_changed"),
    [{ type: "filesystem_changed", path: "photos" }],
  );

  unsubscribe();
  await harness.backend.upload(textFile("b.txt", "b"), "b.txt");
  assert.equal(events.filter((event) => event.type === "filesystem_changed").length, 1);
  harness.store.close();
});

test("upload requests persistent storage only once", async () => {
  const harness = createHarness();
  await harness.backend.upload(textFile("a.txt", "a"), "a.txt");
  await harness.backend.upload(textFile("b.txt", "b"), "b.txt");
  assert.equal(harness.persistCalls, 1);
  harness.store.close();
});

test("upload rejects an already aborted signal", async () => {
  const { backend, store } = createHarness();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => backend.upload(textFile("a.txt", "a"), "a.txt", undefined, controller.signal),
    (err: unknown) => err instanceof DOMException && err.name === "AbortError",
  );
  assert.equal(await store.getNode("a.txt"), null);
  store.close();
});

test("runAction supports mkdir, rename, copy, move, and delete", async () => {
  const { backend, store } = createHarness();

  await backend.runAction({ actionId: "file.mkdir", paths: [""], newName: "photos" });
  assert.equal((await store.getNode("photos"))?.is_dir, true);

  await backend.upload(textFile("a.txt", "a"), "photos/a.txt");

  await backend.runAction({ actionId: "file.rename", paths: ["photos/a.txt"], newName: "b.txt" });
  assert.equal(await store.getNode("photos/a.txt"), null);
  assert.equal((await store.getNode("photos/b.txt"))?.size, 1);

  await backend.runAction({ actionId: "file.mkdir", paths: [""], newName: "backup" });
  await backend.runAction({
    actionId: "file.copy",
    paths: ["photos/b.txt"],
    destDir: "backup",
  });
  assert.equal(await (await store.readBlob("backup/b.txt")).text(), "a");

  await backend.runAction({
    actionId: "file.move",
    paths: ["photos/b.txt"],
    destDir: "backup",
    overwrite: true,
  });
  assert.equal(await store.getNode("photos/b.txt"), null);

  await backend.runAction({ actionId: "file.delete", paths: ["backup"] });
  assert.equal(await store.getNode("backup"), null);
  store.close();
});

test("runAction rejects an unknown action", async () => {
  const { backend, store } = createHarness();
  await assert.rejects(
    () => backend.runAction({ actionId: "file.chmod", paths: ["a.txt"] }),
    /unknown action/,
  );
  store.close();
});

test("downloadUrl caches blob URLs and revokes them when the file changes", async () => {
  const harness = createHarness();
  await harness.backend.upload(textFile("a.txt", "hello"), "a.txt");

  const url = await harness.backend.downloadUrl("a.txt");
  assert.equal(await harness.backend.downloadUrl("a.txt"), url);
  assert.equal(harness.createdUrls.length, 1);

  await harness.backend.upload(textFile("a.txt", "changed"), "a.txt");
  assert.deepEqual(harness.revokedUrls, [url]);

  const refreshed = await harness.backend.downloadUrl("a.txt");
  assert.notEqual(refreshed, url);

  await harness.backend.runAction({ actionId: "file.delete", paths: ["a.txt"] });
  assert.deepEqual(harness.revokedUrls, [url, refreshed]);
  await assert.rejects(
    () => harness.backend.downloadUrl("a.txt"),
    (err: unknown) => isBrowserFsError(err, "not-found"),
  );
  harness.store.close();
});

test("dispose revokes outstanding blob URLs", async () => {
  const harness = createHarness();
  await harness.backend.upload(textFile("a.txt", "hello"), "a.txt");
  const url = await harness.backend.downloadUrl("a.txt");

  harness.backend.dispose();

  assert.deepEqual(harness.revokedUrls, [url]);
  harness.store.close();
});

test("fetchHealth reports a writable backend", async () => {
  const { backend, store } = createHarness();
  assert.deepEqual(await backend.fetchHealth(), { read_only: false });
  store.close();
});

test("storageUsage prefers the browser estimate over stored sizes", async () => {
  databaseCounter += 1;
  const store = new BrowserFsStore({
    factory: new IDBFactory(),
    databaseName: `zfiles-browser-usage-test-${databaseCounter}`,
  });
  const backend = createBrowserBackend({
    store,
    storage: { estimate: () => Promise.resolve({ usage: 4096, quota: 1_000_000 }) },
  });

  assert.deepEqual(await backend.storageUsage(), { usage: 4096, quota: 1_000_000 });
  store.close();
});

test("storageUsage falls back to stored file sizes without an estimate API", async () => {
  const harness = createHarness();
  await harness.backend.upload(textFile("a.txt", "12345"), "a.txt");
  assert.deepEqual(await harness.backend.storageUsage(), { usage: 5, quota: 0 });
  harness.store.close();
});

test("regaining focus re-announces the last listed directory", async () => {
  const focusTarget = new EventTarget();
  const harness = createHarness(focusTarget);
  await harness.store.makeDirectory("photos");
  await harness.backend.list("photos");

  const events: BackendEvent[] = [];
  const unsubscribe = harness.backend.subscribe((event) => events.push(event));
  focusTarget.dispatchEvent(new Event("focus"));

  assert.deepEqual(
    events.filter((event) => event.type === "filesystem_changed"),
    [{ type: "filesystem_changed", path: "photos" }],
  );

  unsubscribe();
  focusTarget.dispatchEvent(new Event("focus"));
  assert.equal(events.filter((event) => event.type === "filesystem_changed").length, 1);
  harness.store.close();
});

test("subscribe reports connected status immediately", () => {
  const { backend, store } = createHarness();
  const statuses: string[] = [];
  const events: BackendEvent[] = [];
  const unsubscribe = backend.subscribe(
    (event) => events.push(event),
    (status) => statuses.push(status),
  );

  assert.deepEqual(statuses, ["connecting", "connected"]);
  assert.equal(events[0].type, "connected");
  unsubscribe();
  store.close();
});
