import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";

import { BrowserFsStore } from "./store";
import { isBrowserFsError } from "./errors";

let databaseCounter = 0;

function createStore(now = () => 1_700_000_000_000): BrowserFsStore {
  databaseCounter += 1;
  return new BrowserFsStore({
    factory: new IDBFactory(),
    databaseName: `zfiles-browser-fs-test-${databaseCounter}`,
    now,
  });
}

function textBlob(text: string): Blob {
  return new Blob([text], { type: "text/plain" });
}

async function childNames(store: BrowserFsStore, path: string): Promise<string[]> {
  const children = await store.listChildren(path);
  return children.map((child) => child.name);
}

test("writeFile creates missing ancestor directories", async () => {
  const store = createStore();
  await store.writeFile("photos/2024/a.txt", textBlob("hello"));

  assert.deepEqual(await childNames(store, ""), ["photos"]);
  assert.deepEqual(await childNames(store, "photos"), ["2024"]);

  const [file] = await store.listChildren("photos/2024");
  assert.equal(file.name, "a.txt");
  assert.equal(file.is_dir, false);
  assert.equal(file.size, 5);
  assert.equal(file.contentType, "text/plain");
  assert.equal(file.modified, 1_700_000_000_000);

  const parent = await store.getNode("photos/2024");
  assert.equal(parent?.is_dir, true);
  store.close();
});

test("readBlob round-trips file contents", async () => {
  const store = createStore();
  await store.writeFile("notes.txt", textBlob("hello world"));
  const blob = await store.readBlob("notes.txt");
  assert.equal(await blob.text(), "hello world");
  store.close();
});

test("writeFile replaces an existing file without leaking its blob", async () => {
  const store = createStore();
  await store.writeFile("notes.txt", textBlob("first"));
  await store.writeFile("notes.txt", textBlob("second draft"));

  const blob = await store.readBlob("notes.txt");
  assert.equal(await blob.text(), "second draft");
  const node = await store.getNode("notes.txt");
  assert.equal(node?.size, 12);
  assert.equal(await store.countBlobs(), 1);
  store.close();
});

test("writeFile refuses to overwrite a directory", async () => {
  const store = createStore();
  await store.makeDirectory("photos");
  await assert.rejects(
    () => store.writeFile("photos", textBlob("nope")),
    (err: unknown) => isBrowserFsError(err, "already-exists"),
  );
  store.close();
});

test("makeDirectory rejects duplicates and invalid names", async () => {
  const store = createStore();
  await store.makeDirectory("photos");
  await assert.rejects(
    () => store.makeDirectory("photos"),
    (err: unknown) => isBrowserFsError(err, "already-exists"),
  );
  await assert.rejects(
    () => store.makeDirectory("photos/.."),
    (err: unknown) => isBrowserFsError(err, "invalid-name"),
  );
  store.close();
});

test("listChildren reports a missing directory instead of an empty listing", async () => {
  const store = createStore();
  assert.deepEqual(await store.listChildren(""), []);
  await assert.rejects(
    () => store.listChildren("nope"),
    (err: unknown) => isBrowserFsError(err, "not-found"),
  );
  store.close();
});

test("getNode returns null for a missing path", async () => {
  const store = createStore();
  assert.equal(await store.getNode("nope.txt"), null);
  store.close();
});

test("remove deletes a subtree and its blobs", async () => {
  const store = createStore();
  await store.writeFile("photos/2024/a.txt", textBlob("a"));
  await store.writeFile("photos/2024/b.txt", textBlob("b"));
  await store.writeFile("keep.txt", textBlob("keep"));
  assert.equal(await store.countBlobs(), 3);

  await store.remove(["photos"]);

  assert.deepEqual(await childNames(store, ""), ["keep.txt"]);
  assert.equal(await store.getNode("photos/2024/a.txt"), null);
  assert.equal(await store.countBlobs(), 1);
  store.close();
});

test("move rewrites descendant paths and reuses stored blobs", async () => {
  const store = createStore();
  await store.writeFile("photos/2024/a.txt", textBlob("a"));
  await store.makeDirectory("archive");

  await store.move("photos", "archive/photos");

  assert.equal(await store.getNode("photos"), null);
  assert.equal((await store.getNode("archive/photos/2024/a.txt"))?.is_dir, false);
  assert.equal(await (await store.readBlob("archive/photos/2024/a.txt")).text(), "a");
  assert.equal(await store.countBlobs(), 1);
  store.close();
});

test("move refuses to descend into its own subtree", async () => {
  const store = createStore();
  await store.makeDirectory("photos");
  await store.makeDirectory("photos/2024");
  await assert.rejects(
    () => store.move("photos", "photos/2024/photos"),
    (err: unknown) => isBrowserFsError(err, "into-descendant"),
  );
  store.close();
});

test("copy duplicates a subtree with independent blobs", async () => {
  const store = createStore();
  await store.writeFile("photos/a.txt", textBlob("a"));

  await store.copy("photos", "backup");

  assert.equal(await (await store.readBlob("backup/a.txt")).text(), "a");
  assert.equal(await (await store.readBlob("photos/a.txt")).text(), "a");
  assert.equal(await store.countBlobs(), 2);

  await store.remove(["photos"]);
  assert.equal(await (await store.readBlob("backup/a.txt")).text(), "a");
  store.close();
});

test("copy and move honor the overwrite flag", async () => {
  const store = createStore();
  await store.writeFile("a.txt", textBlob("source"));
  await store.writeFile("b.txt", textBlob("dest"));

  await assert.rejects(
    () => store.copy("a.txt", "b.txt"),
    (err: unknown) => isBrowserFsError(err, "already-exists"),
  );

  await store.copy("a.txt", "b.txt", { overwrite: true });
  assert.equal(await (await store.readBlob("b.txt")).text(), "source");
  assert.equal(await store.countBlobs(), 2);

  await store.move("a.txt", "b.txt", { overwrite: true });
  assert.equal(await store.getNode("a.txt"), null);
  assert.equal(await (await store.readBlob("b.txt")).text(), "source");
  assert.equal(await store.countBlobs(), 1);
  store.close();
});

test("move into a missing directory reports not-found", async () => {
  const store = createStore();
  await store.writeFile("a.txt", textBlob("a"));
  await assert.rejects(
    () => store.move("a.txt", "nope/a.txt"),
    (err: unknown) => isBrowserFsError(err, "not-found"),
  );
  store.close();
});

test("usageBytes sums stored file sizes", async () => {
  const store = createStore();
  await store.writeFile("a.txt", textBlob("12345"));
  await store.writeFile("dir/b.txt", textBlob("123"));
  assert.equal(await store.usageBytes(), 8);
  store.close();
});
