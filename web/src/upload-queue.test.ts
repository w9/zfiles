import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyProgressUpdate,
  createQueueItem,
  formatEtaSeconds,
  isUploadAbortError,
  PROGRESS_UI_MIN_INTERVAL_MS,
  shouldCommitProgressUi,
  uploadPercent,
} from "./upload-queue";

test("createQueueItem starts pending with file size as total", () => {
  const file = new File(["hello"], "a.txt", { type: "text/plain" });
  const item = createQueueItem(file, "dir/a.txt");
  assert.equal(item.status, "pending");
  assert.equal(item.total, 5);
  assert.equal(item.destPath, "dir/a.txt");
});

test("uploadPercent clamps to 100", () => {
  const file = new File(["x"], "b.txt");
  const item = createQueueItem(file, "b.txt");
  item.offset = 50;
  item.total = 100;
  assert.equal(uploadPercent(item), 50);
  item.offset = 200;
  assert.equal(uploadPercent(item), 100);
});

test("applyProgressUpdate computes speed and eta from samples", () => {
  const file = new File([new Uint8Array(10_000)], "big.bin");
  const item = createQueueItem(file, "big.bin");
  const t0 = 1_000;
  const first = applyProgressUpdate(item, 0, 10_000, t0, []);
  const second = applyProgressUpdate(first.item, 5_000, 10_000, t0 + 1_000, first.samples);
  assert.equal(second.item.offset, 5_000);
  assert.ok(second.item.speedBps != null && second.item.speedBps >= 4_900);
  assert.ok(second.item.etaSeconds != null && second.item.etaSeconds > 0);
});

test("isUploadAbortError detects abort errors", () => {
  assert.equal(isUploadAbortError(new DOMException("x", "AbortError")), true);
  assert.equal(isUploadAbortError(new Error("x")), false);
});

test("shouldCommitProgressUi allows first update and 1 fps thereafter", () => {
  const t0 = 10_000;
  assert.equal(shouldCommitProgressUi(undefined, t0, false), true);
  assert.equal(shouldCommitProgressUi(t0, t0 + 500, false), false);
  assert.equal(
    shouldCommitProgressUi(t0, t0 + PROGRESS_UI_MIN_INTERVAL_MS, false),
    true,
  );
  assert.equal(shouldCommitProgressUi(t0, t0 + 100, true), true);
});

test("formatEtaSeconds uses seconds, minutes, and hours", () => {
  assert.equal(formatEtaSeconds(12.2), "13s");
  assert.equal(formatEtaSeconds(90), "2m");
  assert.equal(formatEtaSeconds(7200), "2h");
  assert.equal(formatEtaSeconds(null), null);
});
