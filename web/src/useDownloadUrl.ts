import { useEffect, useState } from "react";

import type { ExplorerBackend } from "./backend/types";

export function useDownloadUrl(
  backend: ExplorerBackend,
  path: string | null,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void Promise.resolve(backend.downloadUrl(path)).then((resolved) => {
      if (!cancelled) {
        setUrl(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [backend, path]);

  return url;
}
