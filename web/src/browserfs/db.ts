export const BROWSER_FS_DATABASE_NAME = "zfiles-browser-fs";
export const BROWSER_FS_DATABASE_VERSION = 1;
export const NODES_STORE = "nodes";
export const BLOBS_STORE = "blobs";
export const PARENT_INDEX = "by_parent";

/**
 * One record per file or directory. Metadata lives here and file bytes live in the
 * separate blob store, so listings never read file contents.
 */
export type BrowserFsNode = {
  path: string;
  parent: string;
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
  contentType?: string;
  blobId?: string;
};

export type BrowserFsBlobRecord = {
  id: string;
  blob: Blob;
};

export function createBrowserFsSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(NODES_STORE)) {
    const nodes = db.createObjectStore(NODES_STORE, { keyPath: "path" });
    nodes.createIndex(PARENT_INDEX, "parent");
  }
  if (!db.objectStoreNames.contains(BLOBS_STORE)) {
    db.createObjectStore(BLOBS_STORE, { keyPath: "id" });
  }
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb request failed"));
  });
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("indexeddb transaction aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("indexeddb transaction failed"));
  });
}

export function openBrowserFsDatabase(
  factory: IDBFactory,
  name: string = BROWSER_FS_DATABASE_NAME,
  version: number = BROWSER_FS_DATABASE_VERSION,
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => {
      createBrowserFsSchema(request.result);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb open failed"));
    request.onblocked = () => reject(new Error("indexeddb open blocked by another tab"));
  });
}
