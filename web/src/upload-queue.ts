import { useCallback, useEffect, useRef, useState } from "react";

import type { S3Backend } from "./backend/s3Backend";
import { storeFileHandle } from "./cloud/multipartFileHandles";
import {
  multipartSessionScopeId,
  type MultipartSessionRecord,
} from "./cloud/multipartSessions";
import type { ExplorerBackend, UploadProgress } from "./backend/types";
import {
  findKeepBothPath,
  pathExistsAsFile,
  type UploadConflictResolution,
} from "./upload-conflict";
import type { DroppedUploadFile } from "./useGlobalFileDrop";

export type UploadItemStatus =
  | "pending"
  | "hashing"
  | "active"
  | "verifying"
  | "awaiting_conflict"
  | "done"
  | "failed"
  | "cancelled";

export type { UploadConflictResolution };

export function isUploadAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") {
    return true;
  }
  return err instanceof Error && err.name === "AbortError";
}

export type UploadQueueItem = {
  id: string;
  file: File;
  /** When present, persisted for multipart resume once an upload id is known. */
  sourceFileHandle?: FileSystemFileHandle;
  fileName: string;
  destPath: string;
  /** Epoch ms when the item entered the queue; drives time-sorted panel rows. */
  enqueuedAt: number;
  overwriteExisting?: boolean;
  status: UploadItemStatus;
  offset: number;
  total: number;
  speedBps: number | null;
  etaSeconds: number | null;
  error?: string;
  backendUploadId?: string;
  multipartUpload?: {
    uploadId: string;
    objectKey: string;
  };
  multipartResume?: {
    uploadId: string;
    objectKey: string;
    partSize: number;
    checksumValidation: boolean;
    checksumSha256Base64?: string;
  };
};

type ProgressSample = { time: number; offset: number };

const SPEED_WINDOW_MS = 2000;
export const PROGRESS_UI_MIN_INTERVAL_MS = 1000;

export function shouldCommitProgressUi(
  lastCommitMs: number | undefined,
  now: number,
  force: boolean,
): boolean {
  if (force) {
    return true;
  }
  if (lastCommitMs == null) {
    return true;
  }
  return now - lastCommitMs >= PROGRESS_UI_MIN_INTERVAL_MS;
}

export function createQueueItem(
  file: File,
  destPath: string,
  sourceFileHandle?: FileSystemFileHandle,
): UploadQueueItem {
  return {
    id: crypto.randomUUID(),
    file,
    sourceFileHandle,
    fileName: file.name,
    destPath,
    enqueuedAt: Date.now(),
    status: "pending",
    offset: 0,
    total: file.size,
    speedBps: null,
    etaSeconds: null,
  };
}

export function createResumeQueueItem(
  file: File,
  record: MultipartSessionRecord,
  initialOffset = 0,
): UploadQueueItem {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: record.fileName,
    destPath: record.destPath,
    enqueuedAt: Date.now(),
    status: "pending",
    offset: initialOffset,
    total: record.fileSize,
    speedBps: null,
    etaSeconds: null,
    multipartResume: {
      uploadId: record.uploadId,
      objectKey: record.objectKey,
      partSize: record.partSize,
      checksumValidation: record.checksumValidation,
      checksumSha256Base64: record.checksumSha256Base64,
    },
    multipartUpload: {
      uploadId: record.uploadId,
      objectKey: record.objectKey,
    },
  };
}

/** Upload ids for multipart sessions already represented in the active queue. */
export function activeMultipartUploadIds(items: UploadQueueItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.status === "done" || item.status === "failed" || item.status === "cancelled") {
      continue;
    }
    const uploadId = item.multipartResume?.uploadId ?? item.multipartUpload?.uploadId;
    if (uploadId) {
      ids.add(uploadId);
    }
  }
  return ids;
}

export function uploadPercent(item: UploadQueueItem): number {
  if (item.total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((item.offset / item.total) * 100));
}

/** Map backend progress ids to queue status (upload ids are object keys / tus ids). */
export function uploadProgressVariant(
  status: UploadItemStatus,
): "upload" | "local" {
  if (
    status === "hashing" ||
    status === "verifying" ||
    status === "cancelled" ||
    status === "failed"
  ) {
    return "local";
  }
  return "upload";
}

export function uploadStatusForProgress(progressId: string): UploadItemStatus {
  if (progressId === "hashing") {
    return "hashing";
  }
  if (progressId === "verifying") {
    return "verifying";
  }
  return "active";
}

/** Display order for upload status segments in the panel header. */
export const UPLOAD_QUEUE_HEADER_STATUS_ORDER: UploadItemStatus[] = [
  "active",
  "hashing",
  "verifying",
  "awaiting_conflict",
  "pending",
  "done",
  "failed",
  "cancelled",
];

export function countUploadsByStatus(items: UploadQueueItem[]): Partial<Record<UploadItemStatus, number>> {
  const counts: Partial<Record<UploadItemStatus, number>> = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

export function applyProgressUpdate(
  item: UploadQueueItem,
  offset: number,
  total: number | undefined,
  now: number,
  samples: ProgressSample[],
  backendUploadId?: string,
): { item: UploadQueueItem; samples: ProgressSample[] } {
  const length = total ?? item.total;
  const trimmed = [...samples, { time: now, offset }].filter(
    (sample) => now - sample.time <= SPEED_WINDOW_MS,
  );

  let speedBps: number | null = null;
  if (trimmed.length >= 2) {
    const oldest = trimmed[0];
    const elapsedSec = (now - oldest.time) / 1000;
    if (elapsedSec > 0) {
      speedBps = Math.max(0, (offset - oldest.offset) / elapsedSec);
    }
  }

  let etaSeconds: number | null = null;
  if (speedBps != null && speedBps > 0 && length > offset) {
    etaSeconds = (length - offset) / speedBps;
  }

  return {
    item: {
      ...item,
      offset,
      total: length,
      speedBps,
      etaSeconds,
      backendUploadId: backendUploadId ?? item.backendUploadId,
    },
    samples: trimmed,
  };
}

export function formatEtaSeconds(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
}

type UseUploadQueueOptions = {
  backend: ExplorerBackend;
  readOnly?: boolean;
  onItemComplete?: () => void;
  onItemFailed?: (message: string) => void;
  onMultipartSessionFinished?: (uploadId: string) => void;
};

export function useUploadQueue({
  backend,
  readOnly = false,
  onItemComplete,
  onItemFailed,
  onMultipartSessionFinished,
}: UseUploadQueueOptions) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const samplesRef = useRef(new Map<string, ProgressSample[]>());
  const lastProgressUiAtRef = useRef(new Map<string, number>());
  const pendingProgressItemRef = useRef(new Map<string, UploadQueueItem>());
  const progressFlushTimerRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const abortControllersRef = useRef(new Map<string, AbortController>());
  const cancelledIdsRef = useRef(new Set<string>());
  const applyToAllResolutionRef = useRef<UploadConflictResolution | null>(null);
  const workerRef = useRef(false);

  useEffect(() => {
    if (items.length === 0) {
      applyToAllResolutionRef.current = null;
    }
  }, [items.length]);

  const clearProgressFlush = useCallback((queueId: string) => {
    const timer = progressFlushTimerRef.current.get(queueId);
    if (timer != null) {
      clearTimeout(timer);
      progressFlushTimerRef.current.delete(queueId);
    }
    pendingProgressItemRef.current.delete(queueId);
  }, []);

  const commitProgressItem = useCallback(
    (queueId: string, updated: UploadQueueItem, force: boolean) => {
      const now = Date.now();
      const lastCommit = lastProgressUiAtRef.current.get(queueId);
      if (!shouldCommitProgressUi(lastCommit, now, force)) {
        pendingProgressItemRef.current.set(queueId, updated);
        if (!progressFlushTimerRef.current.has(queueId)) {
          const delay = PROGRESS_UI_MIN_INTERVAL_MS - (now - (lastCommit ?? 0));
          const timer = setTimeout(() => {
            progressFlushTimerRef.current.delete(queueId);
            const pending = pendingProgressItemRef.current.get(queueId);
            if (!pending) {
              return;
            }
            pendingProgressItemRef.current.delete(queueId);
            lastProgressUiAtRef.current.set(queueId, Date.now());
            setItems((prev) =>
              prev.map((item) => (item.id === queueId ? pending : item)),
            );
          }, Math.max(0, delay));
          progressFlushTimerRef.current.set(queueId, timer);
        }
        return;
      }

      clearProgressFlush(queueId);
      lastProgressUiAtRef.current.set(queueId, now);
      setItems((prev) => prev.map((item) => (item.id === queueId ? updated : item)));
    },
    [clearProgressFlush],
  );

  const ingestProgress = useCallback(
    (
      queueId: string,
      item: UploadQueueItem,
      offset: number,
      total: number | undefined,
      backendUploadId?: string,
    ) => {
      const samples = samplesRef.current.get(queueId) ?? [];
      const { item: updated, samples: nextSamples } = applyProgressUpdate(
        item,
        offset,
        total,
        Date.now(),
        samples,
        backendUploadId,
      );
      samplesRef.current.set(queueId, nextSamples);
      return updated;
    },
    [],
  );

  const persistedSourceHandlesRef = useRef(new Set<string>());

  const enqueue = useCallback(
    (
      dropped: DroppedUploadFile[] | FileList | File[] | null,
      basePath: string,
    ) => {
      if (!dropped || readOnly) {
        return;
      }
      const list: DroppedUploadFile[] = Array.isArray(dropped)
        ? dropped.length > 0 && dropped[0] instanceof File
          ? (dropped as File[]).map((file) => ({ file, sourceHandle: null }))
          : (dropped as DroppedUploadFile[])
        : Array.from(dropped).map((file) => ({ file, sourceHandle: null }));
      if (list.length === 0) {
        return;
      }
      const newItems = list.map(({ file, sourceHandle }) =>
        createQueueItem(
          file,
          basePath ? `${basePath}/${file.name}` : file.name,
          sourceHandle ?? undefined,
        ),
      );
      setItems((prev) => [...prev, ...newItems]);
    },
    [readOnly],
  );

  const enqueueResume = useCallback(
    (file: File, record: MultipartSessionRecord, initialOffset = 0) => {
      if (readOnly) {
        return;
      }
      setItems((prev) => [...prev, createResumeQueueItem(file, record, initialOffset)]);
    },
    [readOnly],
  );

  const applyRemoteProgress = useCallback(
    (progress: UploadProgress) => {
      const active = itemsRef.current.find(
        (item) =>
          item.status === "active" &&
          (item.backendUploadId === progress.id || item.backendUploadId == null),
      );
      if (!active) {
        return;
      }
      const updated = ingestProgress(
        active.id,
        active,
        progress.offset,
        progress.length,
        progress.id,
      );
      commitProgressItem(active.id, updated, false);
    },
    [commitProgressItem, ingestProgress],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) =>
      prev.filter(
        (item) =>
          item.status !== "done" &&
          item.status !== "failed" &&
          item.status !== "cancelled",
      ),
    );
  }, []);

  const cancelUpload = useCallback((queueId: string) => {
    const item = itemsRef.current.find((entry) => entry.id === queueId);
    if (!item) {
      return;
    }
    cancelledIdsRef.current.add(queueId);
    clearProgressFlush(queueId);
    if (item.status === "pending" || item.status === "awaiting_conflict") {
      setItems((prev) => prev.filter((entry) => entry.id !== queueId));
      cancelledIdsRef.current.delete(queueId);
      return;
    }
    if (
      item.status === "active" ||
      item.status === "hashing" ||
      item.status === "verifying"
    ) {
      abortControllersRef.current.get(queueId)?.abort();
      const multipart = item.multipartUpload;
      if (backend.mode === "s3" && multipart) {
        void (backend as S3Backend)
          .abortMultipartSession(multipart.objectKey, multipart.uploadId)
          .then(() => onMultipartSessionFinished?.(multipart.uploadId))
          .catch(() => {});
      }
    }
  }, [backend, clearProgressFlush, onMultipartSessionFinished]);

  const resolveUploadConflict = useCallback(
    (queueId: string, resolution: UploadConflictResolution, applyToAll: boolean) => {
      if (applyToAll) {
        applyToAllResolutionRef.current = resolution;
      }

      void (async () => {
        const item = itemsRef.current.find((entry) => entry.id === queueId);
        if (!item || item.status !== "awaiting_conflict") {
          return;
        }

        if (resolution === "skip") {
          setItems((prev) =>
            prev.map((entry) =>
              entry.id === queueId
                ? { ...entry, status: "cancelled" as const, speedBps: null, etaSeconds: null }
                : entry,
            ),
          );
          return;
        }

        if (resolution === "keep_both") {
          const newPath = await findKeepBothPath(backend, item.destPath);
          setItems((prev) =>
            prev.map((entry) =>
              entry.id === queueId
                ? { ...entry, destPath: newPath, status: "pending" as const }
                : entry,
            ),
          );
          return;
        }

        setItems((prev) =>
          prev.map((entry) =>
            entry.id === queueId
              ? { ...entry, status: "pending" as const, overwriteExisting: true }
              : entry,
          ),
        );
      })();
    },
    [backend],
  );

  const handleUploadConflict = useCallback(
    async (
      item: UploadQueueItem,
    ): Promise<
      | { outcome: "proceed"; destPath: string }
      | { outcome: "paused" }
      | { outcome: "skipped" }
    > => {
      let destPath = item.destPath;
      if (item.overwriteExisting) {
        return { outcome: "proceed", destPath };
      }
      if (!(await pathExistsAsFile(backend, destPath))) {
        return { outcome: "proceed", destPath };
      }

      const auto = applyToAllResolutionRef.current;
      if (!auto) {
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, status: "awaiting_conflict" as const } : entry,
          ),
        );
        return { outcome: "paused" };
      }

      if (auto === "skip") {
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "cancelled" as const, speedBps: null, etaSeconds: null }
              : entry,
          ),
        );
        return { outcome: "skipped" };
      }

      if (auto === "keep_both") {
        destPath = await findKeepBothPath(backend, destPath);
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, destPath } : entry,
          ),
        );
      } else if (auto === "replace") {
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, overwriteExisting: true } : entry,
          ),
        );
      }

      return { outcome: "proceed", destPath };
    },
    [backend],
  );

  useEffect(() => {
    const run = async () => {
      if (workerRef.current) {
        return;
      }
      const pending = itemsRef.current.find((item) => item.status === "pending");
      if (!pending) {
        return;
      }

      workerRef.current = true;
      const queueId = pending.id;
      if (cancelledIdsRef.current.has(queueId)) {
        cancelledIdsRef.current.delete(queueId);
        workerRef.current = false;
        return;
      }

      const conflictResult = pending.multipartResume
        ? { outcome: "proceed" as const, destPath: pending.destPath }
        : await handleUploadConflict(pending);
      if (conflictResult.outcome === "paused" || conflictResult.outcome === "skipped") {
        workerRef.current = false;
        return;
      }

      const uploadDestPath = conflictResult.destPath;
      const ready = itemsRef.current.find((item) => item.id === queueId) ?? pending;
      if (ready.status !== "pending" && ready.status !== "active") {
        workerRef.current = false;
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === queueId
            ? { ...item, destPath: uploadDestPath }
            : item,
        ),
      );

      const abortController = new AbortController();
      abortControllersRef.current.set(queueId, abortController);

      const patchQueueItem = (patch: Partial<UploadQueueItem> & { status: UploadItemStatus }) => {
        clearProgressFlush(queueId);
        const next = itemsRef.current.map((item) =>
          item.id === queueId ? { ...item, ...patch } : item,
        );
        itemsRef.current = next;
        setItems(next);
      };

      const beginUploadPhase = () => {
        samplesRef.current.set(queueId, []);
        lastProgressUiAtRef.current.delete(queueId);
        patchQueueItem({
          status: "active",
          offset: 0,
          speedBps: null,
          etaSeconds: null,
        });
      };

      try {
        if (cancelledIdsRef.current.has(queueId)) {
          abortController.abort();
        }
        const uploadCallbacks = {
          onHashing: () => {
            samplesRef.current.set(queueId, []);
            lastProgressUiAtRef.current.delete(queueId);
            patchQueueItem({
              status: "hashing",
              offset: 0,
              speedBps: null,
              etaSeconds: null,
            });
          },
          onUploadStart: () => {
            if (cancelledIdsRef.current.has(queueId)) {
              abortController.abort();
              return;
            }
            beginUploadPhase();
          },
          onVerifying: () => {
            samplesRef.current.set(queueId, []);
            lastProgressUiAtRef.current.delete(queueId);
            patchQueueItem({
              status: "verifying",
              offset: 0,
              speedBps: null,
              etaSeconds: null,
            });
          },
        };
        const onUploadProgress = (progress: UploadProgress) => {
          if (cancelledIdsRef.current.has(queueId)) {
            return;
          }
          const active = itemsRef.current.find((item) => item.id === queueId);
          if (!active) {
            return;
          }
          const status = uploadStatusForProgress(progress.id);
          if (status === "active" && active.status === "hashing") {
            samplesRef.current.set(queueId, []);
            lastProgressUiAtRef.current.delete(queueId);
          }
          const multipartUpload =
            progress.multipartUploadId && active.multipartUpload?.objectKey
              ? {
                  uploadId: progress.multipartUploadId,
                  objectKey: active.multipartUpload.objectKey,
                }
              : progress.multipartUploadId
                ? {
                    uploadId: progress.multipartUploadId,
                    objectKey: progress.id,
                  }
                : active.multipartUpload;
          if (
            progress.multipartUploadId &&
            active.sourceFileHandle &&
            backend.mode === "s3" &&
            !persistedSourceHandlesRef.current.has(progress.multipartUploadId)
          ) {
            persistedSourceHandlesRef.current.add(progress.multipartUploadId);
            const scopeId = multipartSessionScopeId(
              (backend as S3Backend).connectionConfig,
            );
            void storeFileHandle(
              scopeId,
              progress.multipartUploadId,
              active.sourceFileHandle,
            );
          }
          const updated = ingestProgress(
            queueId,
            {
              ...active,
              status,
              multipartUpload,
            },
            progress.offset,
            progress.length,
            progress.id,
          );
          commitProgressItem(queueId, updated, false);
        };

        if (ready.multipartResume && backend.mode === "s3") {
          const resumeRecord: MultipartSessionRecord = {
            uploadId: ready.multipartResume.uploadId,
            objectKey: ready.multipartResume.objectKey,
            destPath: uploadDestPath,
            fileName: ready.fileName,
            fileSize: ready.total,
            fileLastModified: ready.file.lastModified,
            partSize: ready.multipartResume.partSize,
            checksumValidation: ready.multipartResume.checksumValidation,
            checksumSha256Base64: ready.multipartResume.checksumSha256Base64,
            createdAt: new Date().toISOString(),
          };
          await (backend as S3Backend).resumeUpload(
            ready.file,
            resumeRecord,
            onUploadProgress,
            abortController.signal,
            uploadCallbacks,
          );
        } else {
          await backend.upload(
            ready.file,
            uploadDestPath,
            onUploadProgress,
            abortController.signal,
            uploadCallbacks,
          );
        }
        if (cancelledIdsRef.current.has(queueId)) {
          throw new DOMException("Upload aborted", "AbortError");
        }
        clearProgressFlush(queueId);
        const active = itemsRef.current.find((item) => item.id === queueId);
        const finalItem: UploadQueueItem = {
          ...(active ?? pending),
          status: "done",
          offset: (active ?? pending).total,
          speedBps: null,
          etaSeconds: null,
        };
        commitProgressItem(queueId, finalItem, true);
        samplesRef.current.delete(queueId);
        lastProgressUiAtRef.current.delete(queueId);
        if (ready.multipartResume?.uploadId) {
          onMultipartSessionFinished?.(ready.multipartResume.uploadId);
        }
        onItemComplete?.();
      } catch (err) {
        clearProgressFlush(queueId);
        const active = itemsRef.current.find((item) => item.id === queueId);
        const wasCancelled =
          cancelledIdsRef.current.has(queueId) || isUploadAbortError(err);
        cancelledIdsRef.current.delete(queueId);

        if (wasCancelled) {
          const cancelledItem: UploadQueueItem = {
            ...(active ?? pending),
            status: "cancelled",
            speedBps: null,
            etaSeconds: null,
          };
          commitProgressItem(queueId, cancelledItem, true);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          const failedItem: UploadQueueItem = {
            ...(active ?? pending),
            status: "failed",
            error: message,
            speedBps: null,
            etaSeconds: null,
          };
          commitProgressItem(queueId, failedItem, true);
          onItemFailed?.(message);
        }
        samplesRef.current.delete(queueId);
        lastProgressUiAtRef.current.delete(queueId);
      } finally {
        abortControllersRef.current.delete(queueId);
        workerRef.current = false;
      }
    };

    const hasPending = items.some((item) => item.status === "pending");
    const hasActive = items.some(
      (item) =>
        item.status === "active" ||
        item.status === "hashing" ||
        item.status === "verifying",
    );
    const hasAwaitingConflict = items.some((item) => item.status === "awaiting_conflict");
    if (hasPending && !hasActive && !hasAwaitingConflict) {
      void run();
    }
  }, [items, backend, clearProgressFlush, commitProgressItem, handleUploadConflict, ingestProgress, onItemComplete, onItemFailed, onMultipartSessionFinished]);

  return {
    items,
    enqueue,
    enqueueResume,
    cancelUpload,
    resolveUploadConflict,
    applyRemoteProgress,
    clearFinished,
    hasQueue: items.length > 0,
    conflictItem: items.find((item) => item.status === "awaiting_conflict") ?? null,
  };
}
