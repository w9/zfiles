import { descendantPrefix, normalizePath } from "./paths";

export type BlobUrlCacheOptions = {
  maxEntries?: number;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
};

const DEFAULT_MAX_ENTRIES = 32;

/**
 * Object URLs stay alive until revoked, so every URL handed to the UI is tracked here and
 * released when its path changes, when it falls out of the LRU window, or on teardown.
 */
export class BlobUrlCache {
  private readonly urls = new Map<string, string>();
  private readonly maxEntries: number;
  private readonly create: (blob: Blob) => string;
  private readonly revokeUrl: (url: string) => void;

  constructor(options: BlobUrlCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.create = options.createObjectURL ?? ((blob) => URL.createObjectURL(blob));
    this.revokeUrl = options.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url));
  }

  get(path: string): string | null {
    const key = normalizePath(path);
    const url = this.urls.get(key);
    if (url == null) {
      return null;
    }
    this.urls.delete(key);
    this.urls.set(key, url);
    return url;
  }

  set(path: string, blob: Blob): string {
    const key = normalizePath(path);
    this.invalidateExact(key);
    const url = this.create(blob);
    this.urls.set(key, url);
    this.evict();
    return url;
  }

  /** Release the URL for a path and everything below it. */
  invalidate(path: string): void {
    const key = normalizePath(path);
    if (!key) {
      this.clear();
      return;
    }
    this.invalidateExact(key);
    const prefix = descendantPrefix(key);
    for (const cached of Array.from(this.urls.keys())) {
      if (cached.startsWith(prefix)) {
        this.invalidateExact(cached);
      }
    }
  }

  clear(): void {
    for (const url of this.urls.values()) {
      this.revokeUrl(url);
    }
    this.urls.clear();
  }

  private invalidateExact(key: string): void {
    const url = this.urls.get(key);
    if (url != null) {
      this.revokeUrl(url);
      this.urls.delete(key);
    }
  }

  private evict(): void {
    while (this.urls.size > this.maxEntries) {
      const oldest = this.urls.keys().next();
      if (oldest.done) {
        return;
      }
      this.invalidateExact(oldest.value);
    }
  }
}
