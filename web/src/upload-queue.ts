import { useCallback, useEffect, useRef, useState } from "react";

import type { KernelBackend } from "./backend/kernelBackend";
import type { S3Backend } from "./backend/s3Backend";
import { storeFileHandle } from "./cloud/multipartFileHandles";
import {
  computeMultipartPartSize,
  findMultipartRecord,
  multipartSessionScopeId,
  type MultipartSessionRecord,
  upsertMultipartRecord,
} from "./cloud/multipartSessions";
import {
  removeTusRecord,
  removeOtherTusRecordsForDestPath,
  tusSessionScopeId,
  tusUploadIdFromLocation,
  upsertTusRecord,
  type TusSessionRecord,
} from "./local/tusSessions";
import type { ExplorerBackend, TusUploadResume, UploadProgress } from "./backend/types";
import {
  findKeepBothPath,
  pathExistsAsFile,
  type UploadConflictResolution,
} from "./upload-conflict";
import type { DroppedUploadFile } from "./useGlobalFileDrop";
import {
  readUploadChecksumValidation,
  uploadChecksumValidationEnabled,
} from "./settings/uploadChecksumSettings";
import { prepareUploadFile } from "./materializeUploadFile";
import { useCloudAuth } from "./cloud/CloudAuthContext";

export type UploadItemStatus =
  | "pending"
  | "hashing"
  | "active"
  | "verifying"
  | "paused"
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

export function isUploadPauseError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "PauseError") {
    return true;
  }
  return err instanceof Error && err.name === "PauseError";
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
  /** Bytes durably on the server during active transfer; used when pause ListParts/HEAD fails. */
  committedUploadOffset?: number;
  speedBps: number | null;
  etaSeconds: number | null;
  error?: string;
  backendUploadId?: string;
  /** Local tus session fields preserved when paused mid-transfer. */
  tusResume?: TusUploadResume;
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

/** Queue item ids; falls back when `crypto.randomUUID` is unavailable (HTTP / LAN). */
export function newQueueItemId(): string {
  try {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Safari iOS on http:// LAN shares has no secure context.
  }
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createQueueItem(
  file: File,
  destPath: string,
  sourceFileHandle?: FileSystemFileHandle,
): UploadQueueItem {
  return {
    id: newQueueItemId(),
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
    id: newQueueItemId(),
    file,
    fileName: record.fileName,
    destPath: record.destPath,
    enqueuedAt: Date.now(),
    status: "pending",
    offset: initialOffset,
    committedUploadOffset: initialOffset,
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

export function createTusResumeQueueItem(
  file: File,
  record: TusSessionRecord,
  initialOffset = 0,
): UploadQueueItem {
  return {
    id: newQueueItemId(),
    file,
    fileName: record.fileName,
    destPath: record.destPath,
    enqueuedAt: Date.now(),
    status: "pending",
    offset: initialOffset,
    committedUploadOffset: initialOffset,
    total: record.fileSize,
    speedBps: null,
    etaSeconds: null,
    backendUploadId: record.uploadId,
    tusResume: {
      location: record.tusLocation,
      checksumSha256Base64: record.checksumSha256Base64,
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

/** Tus upload ids already represented in the active queue. */
export function activeTusUploadIds(items: UploadQueueItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.status === "done" || item.status === "failed" || item.status === "cancelled") {
      continue;
    }
    const uploadId =
      item.backendUploadId ??
      (item.tusResume ? tusUploadIdFromLocation(item.tusResume.location) : undefined);
    if (uploadId) {
      ids.add(uploadId);
    }
  }
  return ids;
}

/** Session ids to clear from persistence when a queue item finishes successfully. */
export function finishedUploadSessionIds(item: UploadQueueItem): {
  multipartUploadId?: string;
  tusUploadId?: string;
} {
  const multipartUploadId =
    item.multipartResume?.uploadId ?? item.multipartUpload?.uploadId;
  const tusUploadId =
    item.backendUploadId ??
    (item.tusResume ? tusUploadIdFromLocation(item.tusResume.location) : undefined);
  const result: {
    multipartUploadId?: string;
    tusUploadId?: string;
  } = {};
  if (multipartUploadId) {
    result.multipartUploadId = multipartUploadId;
  }
  if (tusUploadId) {
    result.tusUploadId = tusUploadId;
  }
  return result;
}

export function shouldPersistMultipartCommittedBytes(
  lastPersisted: number | undefined,
  committedBytes: number,
): boolean {
  return lastPersisted !== committedBytes;
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
  "paused",
  "awaiting_conflict",
  "pending",
  "done",
  "failed",
  "cancelled",
];

/** Build multipart resume metadata from a persisted session record. */
export function multipartResumeFromRecord(
  record: MultipartSessionRecord,
): NonNullable<UploadQueueItem["multipartResume"]> {
  return {
    uploadId: record.uploadId,
    objectKey: record.objectKey,
    partSize: record.partSize,
    checksumValidation: record.checksumValidation,
    checksumSha256Base64: record.checksumSha256Base64,
  };
}

export function enrichPausedItemForResume(
  item: UploadQueueItem,
  backend: ExplorerBackend,
): UploadQueueItem {
  if (item.status !== "paused") {
    return item;
  }
  const base: UploadQueueItem = {
    ...item,
    status: "pending",
    speedBps: null,
    etaSeconds: null,
  };
  if (item.multipartResume) {
    return base;
  }
  if (backend.mode === "s3" && item.multipartUpload) {
    const scopeId = multipartSessionScopeId(
      (backend as S3Backend).connectionConfig,
    );
    const record = findMultipartRecord(scopeId, item.multipartUpload.uploadId);
    if (record) {
      return {
        ...base,
        multipartResume: multipartResumeFromRecord(record),
      };
    }
  }
  return base;
}

/** Bytes the next resume would start from; matches server/part truth per AQ. */
export async function resolvePausedUploadOffset(
  item: UploadQueueItem,
  backend: ExplorerBackend,
): Promise<number> {
  if (item.status === "hashing" || item.status === "verifying") {
    return 0;
  }
  if (backend.mode === "s3" && item.multipartUpload) {
    try {
      return await (backend as S3Backend).getMultipartBytesUploaded(
        item.multipartUpload.objectKey,
        item.multipartUpload.uploadId,
      );
    } catch {
      return item.committedUploadOffset ?? 0;
    }
  }
  if (backend.mode === "local" && item.tusResume?.location) {
    try {
      return await (backend as KernelBackend).getTusUploadOffset(item.tusResume.location);
    } catch {
      return 0;
    }
  }
  return item.committedUploadOffset ?? 0;
}

export function removeDoneUploadItem(
  items: UploadQueueItem[],
  queueId: string,
): UploadQueueItem[] {
  return items.filter((item) => item.id !== queueId || item.status !== "done");
}

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
  committedUploadOffset?: number,
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
      committedUploadOffset:
        committedUploadOffset ?? item.committedUploadOffset,
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
  onItemFailed?: (message: string, error?: unknown) => void;
  onMultipartSessionFinished?: (uploadId: string) => void;
  onTusSessionFinished?: (uploadId: string, destPath?: string) => void;
  /** Refresh persisted tus session views after localStorage changes. */
  onTusSessionsChanged?: () => void;
};

export function useUploadQueue({
  backend,
  readOnly = false,
  onItemComplete,
  onItemFailed,
  onMultipartSessionFinished,
  onTusSessionFinished,
  onTusSessionsChanged,
}: UseUploadQueueOptions) {
  const cloudAuth = useCloudAuth();
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const samplesRef = useRef(new Map<string, ProgressSample[]>());
  const lastProgressUiAtRef = useRef(new Map<string, number>());
  const pendingProgressItemRef = useRef(new Map<string, UploadQueueItem>());
  const progressFlushTimerRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const abortControllersRef = useRef(new Map<string, AbortController>());
  const cancelledIdsRef = useRef(new Set<string>());
  const pausedIdsRef = useRef(new Set<string>());
  const applyToAllResolutionRef = useRef<UploadConflictResolution | null>(null);
  const workerRef = useRef(false);

  useEffect(() => {
    if (items.length === 0) {
      applyToAllResolutionRef.current = null;
    }
  }, [items.length]);

  useEffect(() => {
    const flushMultipartRecords = () => {
      if (backend.mode !== "s3") {
        return;
      }
      const s3Backend = backend as S3Backend;
      const scopeId = multipartSessionScopeId(s3Backend.connectionConfig);
      const checksumValidation = uploadChecksumValidationEnabled(
        s3Backend.connectionConfig.provider,
        readUploadChecksumValidation(),
      );
      for (const item of itemsRef.current) {
        if (item.status === "done" || item.status === "cancelled") {
          continue;
        }
        const uploadId =
          item.multipartUpload?.uploadId ?? item.multipartResume?.uploadId;
        const objectKey =
          item.multipartUpload?.objectKey ?? item.multipartResume?.objectKey;
        if (!uploadId || !objectKey) {
          continue;
        }
        upsertMultipartRecord(scopeId, {
          uploadId,
          objectKey,
          destPath: item.destPath,
          fileName: item.fileName,
          fileSize: item.total,
          fileLastModified: item.file.lastModified,
          partSize:
            item.multipartResume?.partSize ?? computeMultipartPartSize(item.total),
          checksumValidation:
            item.multipartResume?.checksumValidation ?? checksumValidation,
          checksumSha256Base64: item.multipartResume?.checksumSha256Base64,
          bytesUploaded: item.committedUploadOffset ?? item.offset,
          createdAt:
            findMultipartRecord(scopeId, uploadId)?.createdAt ?? new Date().toISOString(),
        });
      }
    };
    window.addEventListener("pagehide", flushMultipartRecords);
    return () => window.removeEventListener("pagehide", flushMultipartRecords);
  }, [backend]);

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
      committedUploadOffset?: number,
    ) => {
      const samples = samplesRef.current.get(queueId) ?? [];
      const { item: updated, samples: nextSamples } = applyProgressUpdate(
        item,
        offset,
        total,
        Date.now(),
        samples,
        backendUploadId,
        committedUploadOffset,
      );
      samplesRef.current.set(queueId, nextSamples);
      return updated;
    },
    [],
  );

  const persistedSourceHandlesRef = useRef(new Set<string>());
  const initializedMultipartSessionsRef = useRef(new Set<string>());
  const lastPersistedCommittedBytesRef = useRef(new Map<string, number>());

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

  const enqueueTusResume = useCallback(
    (file: File, record: TusSessionRecord, initialOffset = 0) => {
      if (readOnly) {
        return;
      }
      setItems((prev) => [...prev, createTusResumeQueueItem(file, record, initialOffset)]);
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
        progress.committedOffset,
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

  const clearDone = useCallback((queueId: string) => {
    setItems((prev) => removeDoneUploadItem(prev, queueId));
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
    if (item.status === "paused") {
      cancelledIdsRef.current.delete(queueId);
      const multipart = item.multipartUpload;
      const tusUploadId =
        item.backendUploadId ??
        (item.tusResume ? tusUploadIdFromLocation(item.tusResume.location) : undefined);
      if (backend.mode === "s3" && multipart) {
        void (backend as S3Backend)
          .abortMultipartSession(multipart.objectKey, multipart.uploadId)
          .then(() => onMultipartSessionFinished?.(multipart.uploadId))
          .catch(() => {});
      } else if (backend.mode === "local" && tusUploadId) {
        void (backend as KernelBackend)
          .abortTusSession(tusUploadId)
          .then(() => onTusSessionFinished?.(tusUploadId))
          .catch(() => {});
      }
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === queueId
            ? { ...entry, status: "cancelled" as const, speedBps: null, etaSeconds: null }
            : entry,
        ),
      );
      return;
    }
    if (
      item.status === "active" ||
      item.status === "hashing" ||
      item.status === "verifying"
    ) {
      abortControllersRef.current.get(queueId)?.abort();
      const multipart = item.multipartUpload;
      const tusUploadId =
        item.backendUploadId ??
        (item.tusResume ? tusUploadIdFromLocation(item.tusResume.location) : undefined);
      if (backend.mode === "s3" && multipart) {
        void (backend as S3Backend)
          .abortMultipartSession(multipart.objectKey, multipart.uploadId)
          .then(() => onMultipartSessionFinished?.(multipart.uploadId))
          .catch(() => {});
      } else if (backend.mode === "local" && tusUploadId) {
        void (backend as KernelBackend)
          .abortTusSession(tusUploadId)
          .then(() => onTusSessionFinished?.(tusUploadId))
          .catch(() => {});
      }
    }
  }, [backend, clearProgressFlush, onMultipartSessionFinished, onTusSessionFinished]);

  const pauseUpload = useCallback((queueId: string) => {
    const item = itemsRef.current.find((entry) => entry.id === queueId);
    if (!item || item.status !== "active") {
      return;
    }
    pausedIdsRef.current.add(queueId);
    clearProgressFlush(queueId);
    abortControllersRef.current
      .get(queueId)
      ?.abort(new DOMException("Upload paused", "PauseError"));
  }, [clearProgressFlush]);

  const resumeUpload = useCallback(
    (queueId: string) => {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === queueId && entry.status === "paused"
            ? enrichPausedItemForResume(entry, backend)
            : entry,
        ),
      );
    },
    [backend],
  );

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

      const beginUploadPhase = (resetOffset: boolean) => {
        samplesRef.current.set(queueId, []);
        lastProgressUiAtRef.current.delete(queueId);
        const current = itemsRef.current.find((item) => item.id === queueId);
        patchQueueItem({
          status: "active",
          offset: resetOffset ? 0 : (current?.offset ?? 0),
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
            const current = itemsRef.current.find((item) => item.id === queueId);
            const isResume = !!(current?.tusResume || current?.multipartResume);
            beginUploadPhase(!isResume);
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
          onTransferSession: (session: {
            backendUploadId: string;
            tusLocation: string;
            checksumSha256Base64: string;
          }) => {
            const active = itemsRef.current.find((item) => item.id === queueId);
            const next = itemsRef.current.map((item) =>
              item.id === queueId
                ? {
                    ...item,
                    backendUploadId: session.backendUploadId,
                    tusResume: {
                      location: session.tusLocation,
                      checksumSha256Base64: session.checksumSha256Base64,
                    },
                  }
                : item,
            );
            itemsRef.current = next;
            setItems(next);
            if (backend.mode === "local" && active) {
              const scopeId = tusSessionScopeId();
              const stale = removeOtherTusRecordsForDestPath(
                scopeId,
                active.destPath,
                session.backendUploadId,
              );
              for (const record of stale) {
                void (backend as KernelBackend)
                  .abortTusSession(record.uploadId)
                  .catch(() => {});
              }
              if (stale.length > 0) {
                onTusSessionsChanged?.();
              }
              upsertTusRecord(scopeId, {
                uploadId: session.backendUploadId,
                tusLocation: session.tusLocation,
                destPath: active.destPath,
                fileName: active.fileName,
                fileSize: active.total,
                fileLastModified: active.file.lastModified,
                checksumSha256Base64: session.checksumSha256Base64,
                createdAt: new Date().toISOString(),
              });
            }
          },
          onMultipartSession: (session: {
            uploadId: string;
            objectKey: string;
            partSize: number;
            checksumValidation: boolean;
            checksumSha256Base64?: string;
          }) => {
            const active = itemsRef.current.find((item) => item.id === queueId);
            if (!active || backend.mode !== "s3") {
              return;
            }
            if (initializedMultipartSessionsRef.current.has(session.uploadId)) {
              return;
            }
            initializedMultipartSessionsRef.current.add(session.uploadId);
            const scopeId = multipartSessionScopeId(
              (backend as S3Backend).connectionConfig,
            );
            upsertMultipartRecord(scopeId, {
              uploadId: session.uploadId,
              objectKey: session.objectKey,
              destPath: active.destPath,
              fileName: active.fileName,
              fileSize: active.total,
              fileLastModified: active.file.lastModified,
              partSize: session.partSize,
              checksumValidation: session.checksumValidation,
              checksumSha256Base64: session.checksumSha256Base64,
              createdAt: new Date().toISOString(),
            });
            const next = itemsRef.current.map((item) =>
              item.id === queueId
                ? {
                    ...item,
                    multipartUpload: {
                      uploadId: session.uploadId,
                      objectKey: session.objectKey,
                    },
                  }
                : item,
            );
            itemsRef.current = next;
            setItems(next);
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
          if (progress.multipartUploadId && backend.mode === "s3") {
            const s3Backend = backend as S3Backend;
            const scopeId = multipartSessionScopeId(s3Backend.connectionConfig);
            const objectKey =
              active.multipartUpload?.objectKey ?? progress.id;
            const committedBytes = progress.committedOffset ?? progress.offset;
            const uploadId = progress.multipartUploadId;
            if (
              shouldPersistMultipartCommittedBytes(
                lastPersistedCommittedBytesRef.current.get(uploadId),
                committedBytes,
              )
            ) {
              lastPersistedCommittedBytesRef.current.set(uploadId, committedBytes);
              const existing = findMultipartRecord(scopeId, uploadId);
              const checksumValidation = uploadChecksumValidationEnabled(
                s3Backend.connectionConfig.provider,
                readUploadChecksumValidation(),
              );
              upsertMultipartRecord(scopeId, {
                uploadId,
                objectKey,
                destPath: active.destPath,
                fileName: active.fileName,
                fileSize: active.total,
                fileLastModified: active.file.lastModified,
                partSize: existing?.partSize ?? computeMultipartPartSize(active.total),
                checksumValidation:
                  existing?.checksumValidation ?? checksumValidation,
                checksumSha256Base64: existing?.checksumSha256Base64,
                bytesUploaded: committedBytes,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
              });
            }
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
            progress.committedOffset,
          );
          commitProgressItem(queueId, updated, false);
        };

        const uploadFile = await prepareUploadFile(ready.file);

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
            uploadFile,
            resumeRecord,
            onUploadProgress,
            abortController.signal,
            uploadCallbacks,
          );
        } else if (ready.tusResume && backend.mode === "local") {
          await backend.upload(
            uploadFile,
            uploadDestPath,
            onUploadProgress,
            abortController.signal,
            uploadCallbacks,
            ready.tusResume,
          );
        } else {
          await backend.upload(
            uploadFile,
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
        const finishedItem = active ?? ready;
        const { multipartUploadId, tusUploadId } = finishedUploadSessionIds(finishedItem);
        if (multipartUploadId) {
          onMultipartSessionFinished?.(multipartUploadId);
        }
        if (tusUploadId) {
          onTusSessionFinished?.(tusUploadId, uploadDestPath);
        }
        onItemComplete?.();
      } catch (err) {
        clearProgressFlush(queueId);
        const active = itemsRef.current.find((item) => item.id === queueId);
        const wasPaused =
          pausedIdsRef.current.has(queueId) || isUploadPauseError(err);
        pausedIdsRef.current.delete(queueId);
        const wasCancelled =
          !wasPaused &&
          (cancelledIdsRef.current.has(queueId) || isUploadAbortError(err));
        cancelledIdsRef.current.delete(queueId);

        if (wasPaused) {
          const source = active ?? pending;
          const effectiveOffset = await resolvePausedUploadOffset(source, backend);
          const pausedItem: UploadQueueItem = {
            ...source,
            status: "paused",
            offset: effectiveOffset,
            committedUploadOffset: effectiveOffset,
            speedBps: null,
            etaSeconds: null,
          };
          commitProgressItem(queueId, pausedItem, true);
        } else if (wasCancelled) {
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
          if (!cloudAuth.handleAuthError(err)) {
            onItemFailed?.(message, err);
          }
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
    if (hasPending && !hasActive) {
      void run();
    }
  }, [items, backend, clearProgressFlush, cloudAuth, commitProgressItem, handleUploadConflict, ingestProgress, onItemComplete, onItemFailed, onMultipartSessionFinished, onTusSessionFinished]);

  return {
    items,
    enqueue,
    enqueueResume,
    enqueueTusResume,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    resolveUploadConflict,
    applyRemoteProgress,
    clearFinished,
    clearDone,
    hasQueue: items.length > 0,
    conflictItem: items.find((item) => item.status === "awaiting_conflict") ?? null,
  };
}
