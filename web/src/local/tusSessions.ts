export const TUS_SESSIONS_STORAGE_KEY = "zfiles-tus-sessions";

export type TusSessionRecord = {
  uploadId: string;
  tusLocation: string;
  destPath: string;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  checksumSha256Base64: string;
  createdAt: string;
};

type ScopedStore = Record<string, TusSessionRecord[]>;

/** Scope unfinished tus sessions to the kernel origin serving this tab. */
export function tusSessionScopeId(
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  return origin;
}

export function tusUploadIdFromLocation(location: string): string {
  const segment = location.split("/").pop();
  return segment ?? location;
}

export function fileMatchesTusRecord(file: File, record: TusSessionRecord): boolean {
  return (
    file.name === record.fileName &&
    file.size === record.fileSize &&
    file.lastModified === record.fileLastModified
  );
}

function readStore(): ScopedStore {
  if (typeof window === "undefined") {
    return {};
  }
  const raw = window.localStorage.getItem(TUS_SESSIONS_STORAGE_KEY);
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
  if (typeof window === "undefined") {
    return;
  }
  if (Object.keys(store).length === 0) {
    window.localStorage.removeItem(TUS_SESSIONS_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(TUS_SESSIONS_STORAGE_KEY, JSON.stringify(store));
}

export function readScopedTusRecords(scopeId: string): TusSessionRecord[] {
  return readStore()[scopeId] ?? [];
}

export function findTusRecord(
  scopeId: string,
  uploadId: string,
): TusSessionRecord | undefined {
  return readScopedTusRecords(scopeId).find((entry) => entry.uploadId === uploadId);
}

export function upsertTusRecord(scopeId: string, record: TusSessionRecord): void {
  const store = readStore();
  const existing = store[scopeId] ?? [];
  const next = existing.filter((entry) => entry.uploadId !== record.uploadId);
  next.push(record);
  store[scopeId] = next;
  writeStore(store);
}

export function removeTusRecord(scopeId: string, uploadId: string): void {
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

export function clearScopedTusRecords(scopeId: string): void {
  const store = readStore();
  if (!(scopeId in store)) {
    return;
  }
  delete store[scopeId];
  writeStore(store);
}
