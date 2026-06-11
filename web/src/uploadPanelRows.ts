import type { MultipartSessionView } from "./cloud/useMultipartSessions";
import type { MessageKey } from "./i18n/messages";
import {
  countUploadsByStatus,
  UPLOAD_QUEUE_HEADER_STATUS_ORDER,
  type UploadItemStatus,
  type UploadQueueItem,
} from "./upload-queue";

export type UploadPanelRow =
  | { kind: "queue"; time: number; item: UploadQueueItem }
  | { kind: "session"; time: number; session: MultipartSessionView };

/**
 * One merged panel list: live queue items and unfinished multipart sessions,
 * sorted newest first (queue `enqueuedAt`, session S3 `initiated`). Sessions
 * with no known start time sink to the bottom.
 */
export function mergeUploadPanelRows(
  items: UploadQueueItem[],
  sessions: MultipartSessionView[],
): UploadPanelRow[] {
  const rows: UploadPanelRow[] = [
    ...items.map((item) => ({
      kind: "queue" as const,
      time: item.enqueuedAt,
      item,
    })),
    ...sessions.map((session) => ({
      kind: "session" as const,
      time: session.initiated?.getTime() ?? 0,
      session,
    })),
  ];
  return rows.sort((a, b) => b.time - a.time);
}

export const UPLOAD_HEADER_STATUS_KEYS: Record<UploadItemStatus, MessageKey> = {
  pending: "upload.queue.header.pending",
  hashing: "upload.queue.header.hashing",
  active: "upload.queue.header.active",
  verifying: "upload.queue.header.verifying",
  awaiting_conflict: "upload.queue.header.awaitingConflict",
  done: "upload.queue.header.done",
  failed: "upload.queue.header.failed",
  cancelled: "upload.queue.header.cancelled",
};

export type UploadHeaderSegment = { key: MessageKey; count: number };

/**
 * Header summary segments for the merged list. Unfinished sessions slot in
 * after queued work and before finished history.
 */
export function uploadHeaderSegments(
  items: UploadQueueItem[],
  sessionCount: number,
): UploadHeaderSegment[] {
  const counts = countUploadsByStatus(items);
  const segments: UploadHeaderSegment[] = [];
  for (const status of UPLOAD_QUEUE_HEADER_STATUS_ORDER) {
    if (status === "done" && sessionCount > 0) {
      segments.push({
        key: "upload.queue.header.unfinished",
        count: sessionCount,
      });
    }
    const count = counts[status];
    if (count) {
      segments.push({ key: UPLOAD_HEADER_STATUS_KEYS[status], count });
    }
  }
  return segments;
}
