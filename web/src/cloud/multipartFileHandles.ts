const DB_NAME = "zfiles-multipart-handles";
const DB_VERSION = 1;
const STORE_NAME = "handles";

type StoredHandleRow = {
  key: string;
  handle: FileSystemFileHandle;
};

function handleKey(scopeId: string, uploadId: string): string {
  return `${scopeId}:${uploadId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

export async function getStoredFileHandle(
  scopeId: string,
  uploadId: string,
): Promise<FileSystemFileHandle | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(handleKey(scopeId, uploadId));
      request.onerror = () => reject(request.error ?? new Error("indexedDB get failed"));
      request.onsuccess = () => {
        const row = request.result as StoredHandleRow | undefined;
        resolve(row?.handle ?? null);
      };
    });
  } finally {
    db.close();
  }
}

export async function storeFileHandle(
  scopeId: string,
  uploadId: string,
  handle: FileSystemFileHandle,
): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ key: handleKey(scopeId, uploadId), handle } satisfies StoredHandleRow);
      request.onerror = () => reject(request.error ?? new Error("indexedDB put failed"));
      request.onsuccess = () => resolve();
    });
  } finally {
    db.close();
  }
}

export async function removeStoredFileHandle(scopeId: string, uploadId: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(handleKey(scopeId, uploadId));
      request.onerror = () => reject(request.error ?? new Error("indexedDB delete failed"));
      request.onsuccess = () => resolve();
    });
  } finally {
    db.close();
  }
}
