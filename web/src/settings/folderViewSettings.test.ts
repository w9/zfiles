import assert from "node:assert/strict";
import test from "node:test";

import {
  applyGlobalListingSettings,
  clearAllFolderViewOverrides,
  clearFolderGridCardSizeOverride,
  DEFAULT_COLUMN_SORT,
  readEffectiveFolderViewSettings,
  readFolderViewOverride,
  readGlobalColumnSort,
  writeFolderViewOverride,
} from "./folderViewSettings";

const storage = new Map<string, string>();

function installMockLocalStorage() {
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });
  return () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
  };
}

test("readEffectiveFolderViewSettings falls back to global defaults", () => {
  const restore = installMockLocalStorage();
  storage.clear();
  storage.set("zfiles-listing-view", "grid");
  storage.set("zfiles-listing-column-sort", JSON.stringify([{ id: "size", desc: true }]));
  storage.set("zfiles-grid-card-size", JSON.stringify({ width: 140, height: 150 }));

  const effective = readEffectiveFolderViewSettings("/photos");
  assert.equal(effective.viewMode, "grid");
  assert.deepEqual(effective.columnSort, [{ id: "size", desc: true }]);
  assert.deepEqual(effective.gridCardSize, { width: 140, height: 150 });

  restore();
});

test("writeFolderViewOverride stores per-path settings", () => {
  const restore = installMockLocalStorage();
  storage.clear();

  writeFolderViewOverride("/docs", { viewMode: "table" });
  assert.deepEqual(readFolderViewOverride("/docs"), { viewMode: "table" });
  assert.equal(readEffectiveFolderViewSettings("/docs").viewMode, "table");
  assert.equal(readEffectiveFolderViewSettings("/other").viewMode, "table");

  restore();
});

test("applyGlobalListingSettings updates globals and clears overrides", () => {
  const restore = installMockLocalStorage();
  storage.clear();
  writeFolderViewOverride("/a", { viewMode: "grid" });
  writeFolderViewOverride("/b", { viewMode: "table", columnSort: [{ id: "modified", desc: true }] });

  applyGlobalListingSettings({
    viewMode: "grid",
    columnSort: [{ id: "name", desc: false }],
    gridCardSize: { width: 100, height: 110 },
  });

  assert.equal(storage.get("zfiles-listing-view"), "grid");
  assert.equal(
    storage.get("zfiles-listing-column-sort"),
    JSON.stringify([{ id: "name", desc: false }]),
  );
  assert.equal(
    storage.get("zfiles-grid-card-size"),
    JSON.stringify({ width: 100, height: 110 }),
  );
  assert.equal(readFolderViewOverride("/a"), null);
  assert.equal(readFolderViewOverride("/b"), null);
  assert.deepEqual(readGlobalColumnSort(), DEFAULT_COLUMN_SORT);

  restore();
});

test("clearAllFolderViewOverrides removes the map", () => {
  const restore = installMockLocalStorage();
  storage.clear();
  writeFolderViewOverride("/x", { viewMode: "grid" });
  clearAllFolderViewOverrides();
  assert.equal(readFolderViewOverride("/x"), null);
  restore();
});

test("clearFolderGridCardSizeOverride removes only grid card size", () => {
  const restore = installMockLocalStorage();
  storage.clear();
  storage.set("zfiles-grid-card-size", JSON.stringify({ width: 120, height: 130 }));
  writeFolderViewOverride("/docs", {
    viewMode: "grid",
    gridCardSize: { width: 200, height: 210 },
  });
  writeFolderViewOverride("/photos", {
    gridCardSize: { width: 180, height: 190 },
  });

  clearFolderGridCardSizeOverride("/docs");
  assert.deepEqual(readFolderViewOverride("/docs"), { viewMode: "grid" });
  assert.deepEqual(readEffectiveFolderViewSettings("/docs").gridCardSize, {
    width: 120,
    height: 130,
  });

  clearFolderGridCardSizeOverride("/photos");
  assert.equal(readFolderViewOverride("/photos"), null);

  restore();
});
