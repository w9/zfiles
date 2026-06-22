import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { KernelBackend } from "@/backend/kernelBackend";
import type { ExplorerBackend } from "@/backend/types";
import type { UnfinishedSessionView } from "@/unfinishedUploadSessions";

import { pickFileForTusResume } from "./pickTusResumeFile";
import {
  readScopedTusRecords,
  removeOtherTusRecordsForDestPath,
  removeTusRecord,
  tusSessionScopeId,
  type TusSessionRecord,
} from "./tusSessions";

export type TusSessionView = UnfinishedSessionView & {
  localRecord: TusSessionRecord;
};

type UseTusSessionsOptions = {
  backend: ExplorerBackend;
  readOnly: boolean;
  onResumeEnqueue: (
    file: File,
    record: TusSessionRecord,
    initialOffset?: number,
  ) => void;
  onResumeMismatch: () => void;
  onError: (message: string) => void;
};

function toSessionView(
  record: TusSessionRecord,
  bytesUploaded: number | null,
  resuming: boolean,
  aborting: boolean,
): TusSessionView {
  return {
    uploadId: record.uploadId,
    destPath: record.destPath,
    fileName: record.fileName,
    initiated: new Date(record.createdAt),
    bytesUploaded,
    totalBytes: record.fileSize,
    canResume: true,
    resuming,
    aborting,
    remoteOnly: false,
    progressUnknown: bytesUploaded == null,
    localRecord: record,
  };
}

export function useTusSessions({
  backend,
  readOnly,
  onResumeEnqueue,
  onResumeMismatch,
  onError,
}: UseTusSessionsOptions) {
  const kernelBackend = backend.mode === "local" ? (backend as KernelBackend) : null;
  const scopeId = useMemo(
    () => (kernelBackend ? tusSessionScopeId() : null),
    [kernelBackend],
  );

  const [sessions, setSessions] = useState<TusSessionView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionUploadId, setActionUploadId] = useState<string | null>(null);
  const [actionKind, setActionKind] = useState<"resume" | "abort" | null>(null);

  const onErrorRef = useRef(onError);
  const onResumeEnqueueRef = useRef(onResumeEnqueue);
  const onResumeMismatchRef = useRef(onResumeMismatch);
  onErrorRef.current = onError;
  onResumeEnqueueRef.current = onResumeEnqueue;
  onResumeMismatchRef.current = onResumeMismatch;

  const refresh = useCallback(async () => {
    if (!kernelBackend || !scopeId) {
      setSessions([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const records = readScopedTusRecords(scopeId);
      const merged = await Promise.all(
        records.map(async (record) => {
          try {
            const bytesUploaded = await kernelBackend.getTusUploadOffset(record.tusLocation);
            return toSessionView(record, bytesUploaded, false, false);
          } catch {
            removeTusRecord(scopeId, record.uploadId);
            return null;
          }
        }),
      );
      setSessions(
        merged.filter((entry): entry is TusSessionView => entry != null),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSessions([]);
      onErrorRef.current(message);
    } finally {
      setLoading(false);
    }
  }, [kernelBackend, scopeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resumeSession = useCallback(
    async (uploadId: string) => {
      if (!kernelBackend || !scopeId || readOnly) {
        return;
      }
      const session = sessions.find((entry) => entry.uploadId === uploadId);
      if (!session?.localRecord) {
        return;
      }

      setActionUploadId(uploadId);
      setActionKind("resume");
      setSessions((prev) =>
        prev.map((entry) =>
          entry.uploadId === uploadId ? { ...entry, resuming: true } : entry,
        ),
      );

      try {
        const file = await pickFileForTusResume(
          session.localRecord,
          () => onResumeMismatchRef.current(),
        );
        if (!file) {
          return;
        }
        onResumeEnqueueRef.current(
          file,
          session.localRecord,
          session.bytesUploaded ?? 0,
        );
      } finally {
        setActionUploadId(null);
        setActionKind(null);
        setSessions((prev) =>
          prev.map((entry) =>
            entry.uploadId === uploadId ? { ...entry, resuming: false } : entry,
          ),
        );
      }
    },
    [kernelBackend, readOnly, scopeId, sessions],
  );

  const abortSession = useCallback(
    async (uploadId: string) => {
      if (!kernelBackend || !scopeId) {
        return;
      }
      const session = sessions.find((entry) => entry.uploadId === uploadId);
      if (!session) {
        return;
      }

      setActionUploadId(uploadId);
      setActionKind("abort");
      setSessions((prev) =>
        prev.map((entry) =>
          entry.uploadId === uploadId ? { ...entry, aborting: true } : entry,
        ),
      );

      try {
        await kernelBackend.abortTusSession(session.localRecord.uploadId);
        removeTusRecord(scopeId, uploadId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onErrorRef.current(message);
      } finally {
        setActionUploadId(null);
        setActionKind(null);
        setSessions((prev) =>
          prev.map((entry) =>
            entry.uploadId === uploadId ? { ...entry, aborting: false } : entry,
          ),
        );
      }
    },
    [kernelBackend, refresh, scopeId, sessions],
  );

  const onUploadSessionFinished = useCallback(
    async (uploadId: string, destPath?: string) => {
      if (!scopeId || !kernelBackend) {
        return;
      }
      removeTusRecord(scopeId, uploadId);
      if (destPath) {
        const stale = removeOtherTusRecordsForDestPath(scopeId, destPath, uploadId);
        await Promise.all(
          stale.map(async (record) => {
            try {
              await kernelBackend.abortTusSession(record.uploadId);
            } catch {
              // Spool may already be gone.
            }
          }),
        );
      }
      await refresh();
    },
    [kernelBackend, refresh, scopeId],
  );

  return {
    enabled: kernelBackend != null,
    sessions,
    loading,
    error,
    readOnly,
    actionUploadId,
    actionKind,
    refresh,
    resumeSession,
    abortSession,
    onUploadSessionFinished,
  };
}
