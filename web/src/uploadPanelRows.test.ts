import assert from "node:assert/strict";
import { test } from "node:test";

import type { UnfinishedSessionView } from "./unfinishedUploadSessions";
import { createQueueItem, type UploadItemStatus, type UploadQueueItem } from "./upload-queue";
import {
  failedStatusTooltip,
  mergeUploadPanelRows,
  nextTouchStatusTooltipOpen,
  queueRowShowsProgress,
  uploadHeaderSegments,
  uploadPanelShowsActionsFooter,
} from "./uploadPanelRows";

function queueItem(
  name: string,
  enqueuedAt: number,
  status: UploadItemStatus = "pending",
): UploadQueueItem {
  return {
    ...createQueueItem(new File(["x"], name), name),
    enqueuedAt,
    status,
  };
}

function session(
  uploadId: string,
  initiated: Date | undefined,
): UnfinishedSessionView {
  return {
    uploadId,
    destPath: `dest/${uploadId}`,
    fileName: `${uploadId}.bin`,
    initiated,
    bytesUploaded: null,
    totalBytes: null,
    canResume: false,
    resuming: false,
    aborting: false,
    remoteOnly: true,
    progressUnknown: true,
  };
}

test("mergeUploadPanelRows interleaves queue items and sessions newest first", () => {
  const rows = mergeUploadPanelRows(
    [queueItem("old.txt", 1_000), queueItem("new.txt", 3_000)],
    [session("mid", new Date(2_000))],
  );
  assert.deepEqual(
    rows.map((row) =>
      row.kind === "queue" ? row.item.fileName : row.session.uploadId,
    ),
    ["new.txt", "mid", "old.txt"],
  );
  assert.deepEqual(
    rows.map((row) => row.time),
    [3_000, 2_000, 1_000],
  );
});

test("mergeUploadPanelRows sinks sessions without an initiated time to the bottom", () => {
  const rows = mergeUploadPanelRows(
    [queueItem("a.txt", 500)],
    [session("dated", new Date(9_000)), session("undated", undefined)],
  );
  assert.deepEqual(
    rows.map((row) =>
      row.kind === "queue" ? row.item.fileName : row.session.uploadId,
    ),
    ["dated", "a.txt", "undated"],
  );
});

test("uploadHeaderSegments slots unfinished sessions before finished history", () => {
  const items = [
    queueItem("a.txt", 1, "active"),
    queueItem("b.txt", 2, "pending"),
    queueItem("c.txt", 3, "done"),
    queueItem("d.txt", 4, "failed"),
  ];
  assert.deepEqual(uploadHeaderSegments(items, 2), [
    { key: "upload.queue.header.active", count: 1 },
    { key: "upload.queue.header.pending", count: 1 },
    { key: "upload.queue.header.unfinished", count: 2 },
    { key: "upload.queue.header.done", count: 1 },
    { key: "upload.queue.header.failed", count: 1 },
  ]);
});

test("uploadHeaderSegments omits the unfinished segment when there are no sessions", () => {
  assert.deepEqual(uploadHeaderSegments([queueItem("a.txt", 1, "done")], 0), [
    { key: "upload.queue.header.done", count: 1 },
  ]);
});

test("uploadHeaderSegments reports sessions alone when the queue is empty", () => {
  assert.deepEqual(uploadHeaderSegments([], 3), [
    { key: "upload.queue.header.unfinished", count: 3 },
  ]);
});

test("queueRowShowsProgress skips done and other terminal/idle statuses", () => {
  const base = queueItem("a.txt", 1, "active");
  base.total = 100;
  base.offset = 40;
  assert.equal(queueRowShowsProgress({ ...base, status: "active" }), true);
  assert.equal(queueRowShowsProgress({ ...base, status: "hashing" }), true);
  assert.equal(queueRowShowsProgress({ ...base, status: "verifying" }), true);
  assert.equal(queueRowShowsProgress({ ...base, status: "paused" }), true);
  assert.equal(queueRowShowsProgress({ ...base, status: "done" }), false);
  assert.equal(queueRowShowsProgress({ ...base, status: "failed" }), false);
  assert.equal(queueRowShowsProgress({ ...base, status: "cancelled" }), false);
  assert.equal(queueRowShowsProgress({ ...base, status: "pending" }), false);
  assert.equal(
    queueRowShowsProgress({ ...base, status: "awaiting_conflict" }),
    false,
  );
  assert.equal(queueRowShowsProgress({ ...base, total: 0, status: "active" }), false);
});

test("failedStatusTooltip keeps non-empty errors and omits blanks", () => {
  assert.equal(failedStatusTooltip("network reset"), "network reset");
  assert.equal(failedStatusTooltip("  trim me  "), "trim me");
  assert.equal(failedStatusTooltip(""), null);
  assert.equal(failedStatusTooltip("   "), null);
  assert.equal(failedStatusTooltip(null), null);
  assert.equal(failedStatusTooltip(undefined), null);
});

test("uploadPanelShowsActionsFooter follows choose-files availability", () => {
  assert.equal(uploadPanelShowsActionsFooter(true), true);
  assert.equal(uploadPanelShowsActionsFooter(false), false);
});

test("nextTouchStatusTooltipOpen toggles and dismisses", () => {
  assert.equal(nextTouchStatusTooltipOpen(false, "toggle"), true);
  assert.equal(nextTouchStatusTooltipOpen(true, "toggle"), false);
  assert.equal(nextTouchStatusTooltipOpen(true, "dismiss"), false);
  assert.equal(nextTouchStatusTooltipOpen(false, "dismiss"), false);
});
