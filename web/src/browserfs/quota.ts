export type StorageManagerLike = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
};

export type StorageUsage = {
  usage: number;
  quota: number;
};

export function defaultStorageManager(): StorageManagerLike | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  return navigator.storage as StorageManagerLike | undefined;
}

export function isQuotaExceededError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const name = (err as { name?: unknown }).name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

/**
 * Ask the browser to keep this origin's storage across eviction pressure. Browsers may
 * grant silently, prompt, or refuse; a refusal is not an error for us.
 */
export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined,
): Promise<boolean> {
  if (!storage?.persist) {
    return false;
  }
  try {
    if (storage.persisted && (await storage.persisted())) {
      return true;
    }
    return await storage.persist();
  } catch {
    return false;
  }
}

export async function readStorageEstimate(
  storage: StorageManagerLike | undefined,
): Promise<StorageUsage | null> {
  if (!storage?.estimate) {
    return null;
  }
  try {
    const estimate = await storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}
