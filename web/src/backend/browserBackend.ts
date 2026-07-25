import { BlobUrlCache } from "../browserfs/blobUrlCache";
import { BrowserFsError } from "../browserfs/errors";
import { joinPath, normalizePath, pathName, pathParent } from "../browserfs/paths";
import {
  defaultStorageManager,
  readStorageEstimate,
  requestPersistentStorage,
  type StorageManagerLike,
  type StorageUsage,
} from "../browserfs/quota";
import { BrowserFsStore, type BrowserFsStoreOptions } from "../browserfs/store";
import type { BrowserFsNode } from "../browserfs/db";
import type { RunActionParams } from "./runActionParams";
import type {
  BackendEvent,
  BackendStatus,
  ExplorerBackend,
  FileEntry,
  FileStat,
  HealthInfo,
  ListResult,
  TusUploadResume,
  UploadCallbacks,
  UploadProgress,
} from "./types";

/** Just enough of `window` to hear about focus; injectable so tests need no DOM. */
export type FocusTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type BrowserBackendOptions = BrowserFsStoreOptions & {
  store?: BrowserFsStore;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  storage?: StorageManagerLike;
  maxCachedUrls?: number;
  focusTarget?: FocusTarget | null;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError");
  }
}

function toFileEntry(node: BrowserFsNode): FileEntry {
  return {
    name: node.name,
    path: node.path,
    is_dir: node.is_dir,
    size: node.size,
    modified: new Date(node.modified).toISOString(),
  };
}

function compareEntries(a: FileEntry, b: FileEntry): number {
  if (a.is_dir !== b.is_dir) {
    return a.is_dir ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

/**
 * Files stored in the visitor's own browser through IndexedDB. This backend is the landing
 * volume for the cloud build: it needs no credentials and no network.
 */
export class BrowserBackend implements ExplorerBackend {
  readonly mode = "browser" as const;
  private readonly store: BrowserFsStore;
  private readonly ownsStore: boolean;
  private readonly urls: BlobUrlCache;
  private readonly storage: StorageManagerLike | undefined;
  private readonly listeners = new Set<(event: BackendEvent) => void>();
  private readonly focusTarget: FocusTarget | null;
  private onFocus: (() => void) | null = null;
  private lastListedPath = "";
  private persistRequested = false;

  constructor(options: BrowserBackendOptions = {}) {
    const {
      store,
      createObjectURL,
      revokeObjectURL,
      storage,
      maxCachedUrls,
      focusTarget,
      ...storeOptions
    } = options;
    this.store = store ?? new BrowserFsStore(storeOptions);
    this.ownsStore = store == null;
    this.urls = new BlobUrlCache({
      createObjectURL,
      revokeObjectURL,
      maxEntries: maxCachedUrls,
    });
    this.storage = storage ?? defaultStorageManager();
    this.focusTarget =
      focusTarget === undefined ? (typeof window === "undefined" ? null : window) : focusTarget;
  }

  async list(path: string, _cursor?: string): Promise<ListResult> {
    const nodes = await this.store.listChildren(path);
    this.lastListedPath = normalizePath(path);
    return { entries: nodes.map(toFileEntry).sort(compareEntries) };
  }

  async stat(path: string): Promise<FileStat> {
    const target = normalizePath(path);
    if (!target) {
      return { path: "", is_dir: true, size: 0 };
    }
    const node = await this.store.getNode(target);
    if (!node) {
      throw new BrowserFsError("not-found", `no such entry: ${target}`);
    }
    return {
      path: node.path,
      is_dir: node.is_dir,
      size: node.size,
      modified: new Date(node.modified).toISOString(),
      extra: node.contentType ? { contentType: node.contentType } : undefined,
    };
  }

  async downloadUrl(path: string): Promise<string> {
    const target = normalizePath(path);
    const cached = this.urls.get(target);
    if (cached != null) {
      return cached;
    }
    return this.urls.set(target, await this.store.readBlob(target));
  }

  async upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    callbacks?: UploadCallbacks,
    _tusResume?: TusUploadResume,
  ): Promise<void> {
    throwIfAborted(signal);
    await this.ensurePersistentStorage();
    throwIfAborted(signal);

    callbacks?.onUploadStart?.();
    onProgress?.({ id: destPath, offset: 0, length: file.size });
    await this.store.writeFile(destPath, file, { contentType: file.type || undefined });
    this.urls.invalidate(destPath);
    onProgress?.({
      id: destPath,
      offset: file.size,
      length: file.size,
      committedOffset: file.size,
    });
    this.notifyChanged([pathParent(destPath)]);
  }

  async runAction(params: RunActionParams): Promise<void> {
    const { actionId, paths, destDir, newName, overwrite = false } = params;

    switch (actionId) {
      case "file.delete": {
        const changed = new Set<string>();
        for (const path of paths) {
          await this.store.remove([path]);
          this.urls.invalidate(path);
          changed.add(pathParent(path));
        }
        this.notifyChanged(changed);
        return;
      }
      case "file.mkdir": {
        const parent = normalizePath(paths[0] ?? "");
        const name = newName?.trim();
        if (!name) {
          throw new BrowserFsError("invalid-name", "new name is required");
        }
        await this.store.makeDirectory(joinPath(parent, name));
        this.notifyChanged([parent]);
        return;
      }
      case "file.rename": {
        const path = paths[0];
        const name = newName?.trim();
        if (!path || !name) {
          throw new BrowserFsError("invalid-name", "path and new name are required");
        }
        const parent = pathParent(path);
        await this.store.move(path, joinPath(parent, name), { overwrite });
        this.urls.invalidate(path);
        this.notifyChanged([parent]);
        return;
      }
      case "file.copy":
      case "file.move": {
        if (destDir == null) {
          throw new BrowserFsError("invalid-name", "destination directory is required");
        }
        const dest = normalizePath(destDir);
        const changed = new Set<string>([dest]);
        for (const source of paths) {
          const name = newName && paths.length === 1 ? newName : pathName(source);
          const target = joinPath(dest, name);
          if (actionId === "file.copy") {
            await this.store.copy(source, target, { overwrite });
          } else {
            await this.store.move(source, target, { overwrite });
            this.urls.invalidate(source);
            changed.add(pathParent(source));
          }
          this.urls.invalidate(target);
        }
        this.notifyChanged(changed);
        return;
      }
      default:
        throw new Error(`unknown action: ${actionId}`);
    }
  }

  async fetchHealth(): Promise<HealthInfo | null> {
    return { read_only: false };
  }

  /** Browser-reported usage, falling back to the size of what we stored ourselves. */
  async storageUsage(): Promise<StorageUsage> {
    const estimate = await readStorageEstimate(this.storage);
    if (estimate) {
      return estimate;
    }
    return { usage: await this.store.usageBytes(), quota: 0 };
  }

  subscribe(
    onEvent: (event: BackendEvent) => void,
    onStatus?: (status: BackendStatus) => void,
  ): () => void {
    this.listeners.add(onEvent);
    this.watchFocus();
    onStatus?.("connecting");
    onEvent({ type: "connected", version: "browser", read_only: false });
    onStatus?.("connected");
    return () => {
      this.listeners.delete(onEvent);
      if (this.listeners.size === 0) {
        this.unwatchFocus();
      }
    };
  }

  dispose(): void {
    this.unwatchFocus();
    this.urls.clear();
    this.listeners.clear();
    if (this.ownsStore) {
      this.store.close();
    }
  }

  /** Every tab on the origin shares one database, so re-read the listing on focus. */
  private watchFocus(): void {
    if (!this.focusTarget || this.onFocus) {
      return;
    }
    this.onFocus = () => {
      this.notifyChanged([this.lastListedPath]);
    };
    this.focusTarget.addEventListener("focus", this.onFocus);
  }

  private unwatchFocus(): void {
    if (this.focusTarget && this.onFocus) {
      this.focusTarget.removeEventListener("focus", this.onFocus);
    }
    this.onFocus = null;
  }

  private notifyChanged(paths: Iterable<string>): void {
    for (const path of new Set(paths)) {
      for (const listener of this.listeners) {
        listener({ type: "filesystem_changed", path });
      }
    }
  }

  private async ensurePersistentStorage(): Promise<void> {
    if (this.persistRequested) {
      return;
    }
    this.persistRequested = true;
    await requestPersistentStorage(this.storage);
  }
}

export function createBrowserBackend(options?: BrowserBackendOptions): BrowserBackend {
  return new BrowserBackend(options);
}
