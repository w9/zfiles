import type { S3ConnectionConfig } from "./types";

export const MULTIPART_SESSIONS_STORAGE_KEY = "zfiles-multipart-sessions";

export type MultipartSessionRecord = {
  uploadId: string;
  objectKey: string;
  destPath: string;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  partSize: number;
  checksumValidation: boolean;
  /** SHA-256 digest (base64) from the initial upload hashing pass; reused on resume. */
  checksumSha256Base64?: string;
  /** Last known committed upload offset; used before S3 ListParts on refresh. */
  bytesUploaded?: number;
  createdAt: string;
};

type ScopedStore = Record<string, MultipartSessionRecord[]>;

export function multipartSessionScopeId(
  config: Pick<S3ConnectionConfig, "provider" | "bucket" | "prefix">,
): string {
  return `${config.provider}:${config.bucket}:${config.prefix}`;
}

export function computeMultipartPartSize(fileSize: number): number {
  const minPartSize = 5 * 1024 * 1024;
  const maxParts = 10_000;
  return Math.max(minPartSize, Math.ceil(fileSize / maxParts));
}

export function fileMatchesMultipartRecordByHandle(
  file: File,
  record: MultipartSessionRecord,
): boolean {
  return file.name === record.fileName && file.size === record.fileSize;
}

export function fileMatchesMultipartRecord(file: File, record: MultipartSessionRecord): boolean {
  return (
    fileMatchesMultipartRecordByHandle(file, record) &&
    file.lastModified === record.fileLastModified
  );
}

function readStore(): ScopedStore {
  if (typeof window === "undefined") {
    return {};
  }
  const raw = window.localStorage.getItem(MULTIPART_SESSIONS_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as ScopedStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: ScopedStore): void {
  window.localStorage.setItem(MULTIPART_SESSIONS_STORAGE_KEY, JSON.stringify(store));
}

export function readScopedMultipartRecords(scopeId: string): MultipartSessionRecord[] {
  return readStore()[scopeId] ?? [];
}

export function findMultipartRecord(
  scopeId: string,
  uploadId: string,
): MultipartSessionRecord | undefined {
  return readScopedMultipartRecords(scopeId).find((entry) => entry.uploadId === uploadId);
}

export function upsertMultipartRecord(scopeId: string, record: MultipartSessionRecord): void {
  const store = readStore();
  const existing = store[scopeId] ?? [];
  const next = existing.filter((entry) => entry.uploadId !== record.uploadId);
  next.push(record);
  store[scopeId] = next;
  writeStore(store);
}

export function clearScopedMultipartRecords(scopeId: string): void {
  const store = readStore();
  if (!(scopeId in store)) {
    return;
  }
  delete store[scopeId];
  writeStore(store);
}

export function removeMultipartRecord(scopeId: string, uploadId: string): void {
  const store = readStore();
  const existing = store[scopeId];
  if (!existing) {
    return;
  }
  const next = existing.filter((entry) => entry.uploadId !== uploadId);
  if (next.length === 0) {
    delete store[scopeId];
  } else {
    store[scopeId] = next;
  }
  writeStore(store);
}

export function pruneStaleMultipartRecords(
  scopeId: string,
  activeUploadIds: ReadonlySet<string>,
): void {
  const store = readStore();
  const existing = store[scopeId];
  if (!existing) {
    return;
  }
  const next = existing.filter((entry) => activeUploadIds.has(entry.uploadId));
  if (next.length === existing.length) {
    return;
  }
  if (next.length === 0) {
    delete store[scopeId];
  } else {
    store[scopeId] = next;
  }
  writeStore(store);
}
