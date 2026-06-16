import { useEffect, useState } from "react";

import type { ExplorerBackend } from "./backend/types";
import { useCloudAuth } from "./cloud/CloudAuthContext";

export function useDownloadUrl(
  backend: ExplorerBackend,
  path: string | null,
): string | null {
  const cloudAuth = useCloudAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void Promise.resolve(backend.downloadUrl(path))
      .then((resolved) => {
        if (!cancelled) {
          setUrl(resolved);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          cloudAuth.handleAuthError(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [backend, cloudAuth, path]);

  return url;
}
