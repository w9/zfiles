import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { S3Backend } from "@/backend/s3Backend";
import type { ExplorerBackend } from "@/backend/types";

import { pickFileForMultipartResume } from "./pickResumeFile";
import {
  multipartSessionScopeId,
  removeMultipartRecord,
  type MultipartSessionRecord,
} from "./multipartSessions";
import { removeStoredFileHandle } from "./multipartFileHandles";
import type { MergedMultipartSession } from "./s3Multipart";
import { useCloudAuth } from "./CloudAuthContext";

export type MultipartSessionView = MergedMultipartSession & {
  resuming: boolean;
  aborting: boolean;
};

type UseMultipartSessionsOptions = {
  backend: ExplorerBackend;
  readOnly: boolean;
  onResumeEnqueue: (
    file: File,
    record: MultipartSessionRecord,
    initialOffset?: number,
  ) => void;
  onResumeMismatch: () => void;
  onError: (message: string) => void;
};

export function useMultipartSessions({
  backend,
  readOnly,
  onResumeEnqueue,
  onResumeMismatch,
  onError,
}: UseMultipartSessionsOptions) {
  const cloudAuth = useCloudAuth();
  const s3Backend = backend.mode === "s3" ? (backend as S3Backend) : null;
  const scopeId = useMemo(
    () => (s3Backend ? multipartSessionScopeId(s3Backend.connectionConfig) : null),
    [s3Backend],
  );

  const [sessions, setSessions] = useState<MultipartSessionView[]>([]);
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
    if (!s3Backend || !scopeId) {
      setSessions([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const merged = await s3Backend.listMultipartSessions();
      setSessions(
        merged.map((session) => ({
          ...session,
          resuming: false,
          aborting: false,
        })),
      );
    } catch (err) {
      if (cloudAuth.handleAuthError(err)) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSessions([]);
      onErrorRef.current(message);
    } finally {
      setLoading(false);
    }
  }, [cloudAuth, s3Backend, scopeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resumeSession = useCallback(
    async (uploadId: string) => {
      if (!s3Backend || !scopeId || readOnly) {
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
        const file = await pickFileForMultipartResume(
          scopeId,
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
    [readOnly, s3Backend, scopeId, sessions],
  );

  const abortSession = useCallback(
    async (uploadId: string) => {
      if (!s3Backend || !scopeId) {
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
        await s3Backend.abortMultipartSession(session.objectKey, uploadId);
        removeMultipartRecord(scopeId, uploadId);
        await removeStoredFileHandle(scopeId, uploadId);
        await refresh();
      } catch (err) {
        if (cloudAuth.handleAuthError(err)) {
          return;
        }
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
    [cloudAuth, refresh, s3Backend, scopeId, sessions],
  );

  const onUploadSessionFinished = useCallback(
    async (uploadId: string) => {
      if (!scopeId) {
        return;
      }
      removeMultipartRecord(scopeId, uploadId);
      await removeStoredFileHandle(scopeId, uploadId);
      await refresh();
    },
    [refresh, scopeId],
  );

  return {
    enabled: s3Backend != null,
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
