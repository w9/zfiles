import assert from "node:assert/strict";
import { test } from "node:test";

import type { ExplorerBackend, FileStat } from "./backend/types";
import {
  findKeepBothPath,
  pathExistsAsFile,
  suggestKeepBothPath,
} from "./upload-conflict";

test("suggestKeepBothPath appends a number before the extension", () => {
  assert.equal(suggestKeepBothPath("budget.pdf", 1), "budget (1).pdf");
  assert.equal(suggestKeepBothPath("dir/budget.pdf", 2), "dir/budget (2).pdf");
  assert.equal(suggestKeepBothPath("README", 1), "README (1)");
});

test("pathExistsAsFile returns true only for existing files", async () => {
  const backend: ExplorerBackend = {
    mode: "local",
    async stat(path: string): Promise<FileStat> {
      if (path === "exists.txt") {
        return { path, is_dir: false, size: 1 };
      }
      if (path === "folder") {
        return { path, is_dir: true, size: 0 };
      }
      throw new Error("not found");
    },
    list: async () => ({ entries: [] }),
    downloadUrl: () => "",
    upload: async () => {},
    runAction: async () => {},
    fetchHealth: async () => null,
    subscribe: () => () => {},
  };

  assert.equal(await pathExistsAsFile(backend, "exists.txt"), true);
  assert.equal(await pathExistsAsFile(backend, "folder"), false);
  assert.equal(await pathExistsAsFile(backend, "missing.txt"), false);
});

test("findKeepBothPath skips occupied numbered names", async () => {
  const taken = new Set(["report.pdf", "report (1).pdf"]);
  const backend: ExplorerBackend = {
    mode: "local",
    async stat(path: string): Promise<FileStat> {
      if (taken.has(path)) {
        return { path, is_dir: false, size: 1 };
      }
      throw new Error("not found");
    },
    list: async () => ({ entries: [] }),
    downloadUrl: () => "",
    upload: async () => {},
    runAction: async () => {},
    fetchHealth: async () => null,
    subscribe: () => () => {},
  };

  assert.equal(await findKeepBothPath(backend, "report.pdf"), "report (2).pdf");
});
