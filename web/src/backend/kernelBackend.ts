import { apiFetch, websocketUrl } from "../api";
import { base64EncodeUtf8 } from "../base64Utf8";
import { sha256Base64, sha256Base64Matches } from "../fileHash";
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

const UPLOAD_CHUNK_SIZE = 256 * 1024;
const HEALTH_POLL_MS = 5_000;

function encodeUploadMetadata(filename: string, checksumBase64: string): string {
  return `filename ${base64EncodeUtf8(filename)},checksum ${checksumBase64}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError");
  }
}

async function headUploadOffset(location: string, signal?: AbortSignal): Promise<number> {
  throwIfAborted(signal);
  const response = await apiFetch(location, { method: "HEAD", signal });
  if (!response.ok) {
    throw new Error(`upload head failed: HTTP ${response.status}`);
  }
  return Number(response.headers.get("Upload-Offset") ?? "0");
}

type PatchUploadResult = {
  ok: boolean;
  status: number;
  uploadOffset: number;
};

/** PATCH one chunk with XHR so upload.onprogress fires while bytes are in flight. */
function patchUploadChunk(
  location: string,
  offset: number,
  chunk: Blob,
  signal: AbortSignal | undefined,
  onChunkProgress?: (loaded: number) => void,
): Promise<PatchUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", location);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Upload-Offset", String(offset));
    xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");

    const onAbort = () => {
      xhr.abort();
    };

    if (signal) {
      if (signal.aborted) {
        reject(new DOMException("Upload aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onChunkProgress?.(event.loaded);
      }
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    xhr.onload = () => {
      cleanup();
      const uploadOffset = Number(
        xhr.getResponseHeader("Upload-Offset") ?? String(offset + chunk.size),
      );
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        uploadOffset,
      });
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("upload patch network error"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    xhr.send(chunk);
  });
}

export class KernelBackend implements ExplorerBackend {
  readonly mode = "local" as const;

  list(path: string, _cursor?: string): Promise<ListResult> {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    return apiFetch(`/api/list${query}`).then(async (response) => {
      if (!response.ok) {
        throw response;
      }
      const entries = (await response.json()) as FileEntry[];
      return { entries };
    });
  }

  async stat(path: string): Promise<FileStat> {
    const response = await apiFetch(`/api/metadata?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      throw response;
    }
    return (await response.json()) as FileStat;
  }

  downloadUrl(path: string): string {
    return `/api/file?path=${encodeURIComponent(path)}`;
  }

  async upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    callbacks?: UploadCallbacks,
    tusResume?: TusUploadResume,
  ): Promise<void> {
    throwIfAborted(signal);

    let checksum: string;
    let location: string;
    let uploadId: string;

    if (tusResume) {
      checksum = tusResume.checksumSha256Base64;
      location = tusResume.location;
      uploadId = location.split("/").pop() ?? location;
      callbacks?.onUploadStart?.();
    } else {
      callbacks?.onHashing?.();
      checksum = await sha256Base64(
        file,
        UPLOAD_CHUNK_SIZE,
        signal,
        (offset, total) => {
          onProgress?.({ id: "hashing", offset, length: total });
        },
      );
      callbacks?.onUploadStart?.();
      const create = await apiFetch("/api/upload", {
        method: "POST",
        headers: {
          "Upload-Length": String(file.size),
          "Upload-Metadata": encodeUploadMetadata(destPath, checksum),
        },
        signal,
      });

      if (!create.ok) {
        throw new Error(`upload create failed: HTTP ${create.status}`);
      }

      const createLocation = create.headers.get("location");
      if (!createLocation) {
        throw new Error("upload create missing location header");
      }

      location = createLocation;
      uploadId = location.split("/").pop() ?? location;
      callbacks?.onTransferSession?.({
        backendUploadId: uploadId,
        tusLocation: location,
        checksumSha256Base64: checksum,
      });
    }

    let offset = await headUploadOffset(location, signal);

    while (offset < file.size) {
      throwIfAborted(signal);
      const chunk = file.slice(offset, offset + UPLOAD_CHUNK_SIZE);
      const patch = await patchUploadChunk(location, offset, chunk, signal, (loaded) => {
        onProgress?.({
          id: uploadId,
          offset: Math.min(offset + loaded, file.size),
          length: file.size,
        });
      });

      if (!patch.ok) {
        if (patch.status === 400) {
          throw new Error(`upload patch failed: HTTP ${patch.status}`);
        }
        offset = await headUploadOffset(location, signal);
        if (offset >= file.size) {
          break;
        }
        continue;
      }

      offset = patch.uploadOffset;
      onProgress?.({ id: uploadId, offset, length: file.size });
    }

    callbacks?.onVerifying?.();
    const verified = await sha256Base64Matches(
      file,
      checksum,
      UPLOAD_CHUNK_SIZE,
      signal,
      (offset, total) => {
        onProgress?.({ id: "verifying", offset, length: total });
      },
    );
    if (!verified) {
      throw new Error("checksum mismatch");
    }
  }

  async runAction(params: import("./runActionParams").RunActionParams): Promise<void> {
    const response = await apiFetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paths: params.paths,
        action_id: params.actionId,
        dest_dir: params.destDir,
        new_name: params.newName,
        overwrite: params.overwrite ?? false,
      }),
    });
    if (!response.ok) {
      throw new Error(`action failed: HTTP ${response.status}`);
    }
  }

  async fetchHealth(): Promise<HealthInfo | null> {
    const response = await apiFetch("/api/health");
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as HealthInfo;
  }

  subscribe(
    onEvent: (event: BackendEvent) => void,
    onStatus?: (status: BackendStatus) => void,
  ): () => void {
    let socket: WebSocket | null = null;
    let pollTimer: number | null = null;
    let cancelled = false;

    const clearPoll = () => {
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const scheduleHealthPoll = () => {
      clearPoll();
      pollTimer = window.setInterval(() => {
        void (async () => {
          if (cancelled) {
            return;
          }
          try {
            const health = await this.fetchHealth();
            if (health != null) {
              reconnect();
            } else {
              onStatus?.("offline");
            }
          } catch {
            onStatus?.("offline");
          }
        })();
      }, HEALTH_POLL_MS);
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      clearPoll();
      onStatus?.("connecting");

      const nextSocket = new WebSocket(websocketUrl("/api/ws"));
      socket = nextSocket;

      nextSocket.onmessage = (message) => {
        const event = JSON.parse(message.data as string) as BackendEvent;
        if (event.type === "connected") {
          onStatus?.("connected");
        }
        onEvent(event);
      };

      nextSocket.onerror = () => {
        onStatus?.("offline");
      };

      nextSocket.onclose = () => {
        if (socket === nextSocket) {
          socket = null;
        }
        if (!cancelled) {
          onStatus?.("offline");
          scheduleHealthPoll();
        }
      };
    };

    const reconnect = () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
      connect();
    };

    connect();

    return () => {
      cancelled = true;
      clearPoll();
      socket?.close();
    };
  }
}

export function createKernelBackend(): KernelBackend {
  return new KernelBackend();
}
