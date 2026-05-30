import { useCallback, useEffect, useRef, useState } from "react";

import type { ExplorerBackend, UploadProgress } from "./backend/types";
import {
  findKeepBothPath,
  pathExistsAsFile,
  type UploadConflictResolution,
} from "./upload-conflict";

export type UploadItemStatus =
  | "pending"
  | "active"
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
  fileName: string;
  destPath: string;
  overwriteExisting?: boolean;
  status: UploadItemStatus;
  offset: number;
  total: number;
  speedBps: number | null;
  etaSeconds: number | null;
  error?: string;
  backendUploadId?: string;
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

export function createQueueItem(file: File, destPath: string): UploadQueueItem {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    destPath,
    status: "pending",
    offset: 0,
    total: file.size,
    speedBps: null,
    etaSeconds: null,
  };
}

export function uploadPercent(item: UploadQueueItem): number {
  if (item.total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((item.offset / item.total) * 100));
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
};

export function useUploadQueue({
  backend,
  readOnly = false,
  onItemComplete,
  onItemFailed,
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

  const enqueue = useCallback(
    (files: FileList | File[] | null, basePath: string) => {
      if (!files || readOnly) {
        return;
      }
      const list = Array.from(files);
      if (list.length === 0) {
        return;
      }
      const newItems = list.map((file) =>
        createQueueItem(file, basePath ? `${basePath}/${file.name}` : file.name),
      );
      setItems((prev) => [...prev, ...newItems]);
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
    if (item.status === "pending" || item.status === "awaiting_conflict") {
      setItems((prev) => prev.filter((entry) => entry.id !== queueId));
      cancelledIdsRef.current.delete(queueId);
      return;
    }
    if (item.status === "active") {
      abortControllersRef.current.get(queueId)?.abort();
    }
  }, []);

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

      const conflictResult = await handleUploadConflict(pending);
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
            ? { ...item, status: "active" as const, destPath: uploadDestPath }
            : item,
        ),
      );
      samplesRef.current.set(queueId, []);

      const abortController = new AbortController();
      abortControllersRef.current.set(queueId, abortController);

      try {
        if (cancelledIdsRef.current.has(queueId)) {
          abortController.abort();
        }
        await backend.upload(
          ready.file,
          uploadDestPath,
          (progress) => {
          const active = itemsRef.current.find((item) => item.id === queueId);
          if (!active) {
            return;
          }
          const updated = ingestProgress(
            queueId,
            active,
            progress.offset,
            progress.length,
            progress.id,
          );
          commitProgressItem(queueId, updated, false);
          },
          abortController.signal,
        );
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
    const hasActive = items.some((item) => item.status === "active");
    const hasAwaitingConflict = items.some((item) => item.status === "awaiting_conflict");
    if (hasPending && !hasActive && !hasAwaitingConflict) {
      void run();
    }
  }, [items, backend, clearProgressFlush, commitProgressItem, handleUploadConflict, ingestProgress, onItemComplete, onItemFailed]);

  return {
    items,
    enqueue,
    cancelUpload,
    resolveUploadConflict,
    applyRemoteProgress,
    clearFinished,
    hasQueue: items.length > 0,
    conflictItem: items.find((item) => item.status === "awaiting_conflict") ?? null,
  };
}
