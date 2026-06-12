import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateUploadStats,
  initialTrayAutoOpenState,
  reduceTrayAutoOpen,
  uploadTrayAttention,
} from "./uploadTray";
import {
  createQueueItem,
  type UploadItemStatus,
  type UploadQueueItem,
} from "./upload-queue";

function makeItem(
  status: UploadItemStatus,
  overrides: Partial<UploadQueueItem> = {},
): UploadQueueItem {
  const total = overrides.total ?? 100;
  const file = new File([new Uint8Array(total)], overrides.fileName ?? "f.bin");
  const item = createQueueItem(file, overrides.destPath ?? "f.bin");
  return {
    ...item,
    status,
    offset: overrides.offset ?? item.offset,
    total,
    speedBps: overrides.speedBps ?? null,
  };
}

test("aggregateUploadStats counts statuses, in-flight and history", () => {
  const stats = aggregateUploadStats([
    makeItem("active"),
    makeItem("hashing"),
    makeItem("verifying"),
    makeItem("pending"),
    makeItem("paused"),
    makeItem("awaiting_conflict"),
    makeItem("done"),
    makeItem("failed"),
    makeItem("cancelled"),
  ]);
  assert.equal(stats.total, 9);
  assert.equal(stats.inFlight, 3);
  assert.equal(stats.pending, 1);
  assert.equal(stats.userPaused, 1);
  assert.equal(stats.awaitingConflict, 1);
  assert.equal(stats.finished, 3);
  assert.equal(stats.hasInFlight, true);
  assert.equal(stats.hasPendingWork, true);
});

test("aggregateUploadStats aggregates active byte progress, speed and eta", () => {
  const stats = aggregateUploadStats([
    makeItem("active", { offset: 30, total: 100, speedBps: 10 }),
    makeItem("active", { offset: 70, total: 100, speedBps: 30 }),
  ]);
  assert.equal(stats.activeBytesTotal, 200);
  assert.equal(stats.activeBytesUploaded, 100);
  assert.equal(stats.percent, 50);
  assert.equal(stats.speedBps, 40);
  assert.equal(stats.etaSeconds, (200 - 100) / 40);
});

test("aggregateUploadStats has no live transfer figures when idle", () => {
  const stats = aggregateUploadStats([makeItem("done", { offset: 100, total: 100 })]);
  assert.equal(stats.hasInFlight, false);
  assert.equal(stats.hasPendingWork, false);
  assert.equal(stats.percent, null);
  assert.equal(stats.speedBps, null);
  assert.equal(stats.etaSeconds, null);
  assert.equal(stats.finished, 1);
});

test("hasPendingWork stays true while only a user-paused item remains", () => {
  const stats = aggregateUploadStats([
    makeItem("paused"),
    makeItem("done"),
  ]);
  assert.equal(stats.hasInFlight, false);
  assert.equal(stats.hasPendingWork, true);
});

test("hasPendingWork stays true while only a conflict item remains", () => {
  const stats = aggregateUploadStats([
    makeItem("awaiting_conflict"),
    makeItem("done"),
  ]);
  assert.equal(stats.hasInFlight, false);
  assert.equal(stats.hasPendingWork, true);
});

test("uploadTrayAttention flags user-paused, conflict, and failed uploads", () => {
  assert.equal(uploadTrayAttention(aggregateUploadStats([makeItem("active")])), false);
  assert.equal(uploadTrayAttention(aggregateUploadStats([makeItem("done")])), false);
  assert.equal(
    uploadTrayAttention(aggregateUploadStats([makeItem("paused")])),
    true,
  );
  assert.equal(
    uploadTrayAttention(aggregateUploadStats([makeItem("awaiting_conflict")])),
    true,
  );
  assert.equal(uploadTrayAttention(aggregateUploadStats([makeItem("failed")])), true);
});

test("reduceTrayAutoOpen opens once when a batch's work appears", () => {
  const opened = reduceTrayAutoOpen(initialTrayAutoOpenState, {
    hasPendingWork: true,
  });
  assert.equal(opened.open, true);
  const stillWorking = reduceTrayAutoOpen(opened.state, { hasPendingWork: true });
  assert.equal(stillWorking.open, false);
});

test("reduceTrayAutoOpen does not reopen mid-batch and re-arms after drain", () => {
  const opened = reduceTrayAutoOpen(initialTrayAutoOpenState, {
    hasPendingWork: true,
  });
  const stillWorking = reduceTrayAutoOpen(opened.state, { hasPendingWork: true });
  assert.equal(stillWorking.open, false);
  const drained = reduceTrayAutoOpen(stillWorking.state, { hasPendingWork: false });
  assert.equal(drained.open, false);
  const newBatch = reduceTrayAutoOpen(drained.state, { hasPendingWork: true });
  assert.equal(newBatch.open, true);
});
