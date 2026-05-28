import { apiFetch, websocketUrl } from "../api";
import { base64EncodeUtf8 } from "../base64Utf8";
import type {
  BackendEvent,
  BackendStatus,
  ContextMenuAction,
  ExplorerBackend,
  FileEntry,
  FileStat,
  HealthInfo,
  ListResult,
  PluginInfo,
  UploadProgress,
} from "./types";

const UPLOAD_CHUNK_SIZE = 256 * 1024;
const HEALTH_POLL_MS = 5_000;

function encodePathForQuery(path: string): string {
  return encodeURIComponent(path).replace(/%2F/g, "/");
}

function encodeUploadMetadata(filename: string): string {
  return `filename ${base64EncodeUtf8(filename)}`;
}

async function headUploadOffset(location: string): Promise<number> {
  const response = await apiFetch(location, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`upload head failed: HTTP ${response.status}`);
  }
  return Number(response.headers.get("Upload-Offset") ?? "0");
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

  thumbnailUrl(path: string, tier = "grid"): string {
    return `/api/thumbnail?path=${encodePathForQuery(path)}&tier=${encodeURIComponent(tier)}`;
  }

  async previewText(path: string): Promise<string | null> {
    const response = await apiFetch(`/api/preview?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      return null;
    }
    return response.text();
  }

  async upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<void> {
    const create = await apiFetch("/api/upload", {
      method: "POST",
      headers: {
        "Upload-Length": String(file.size),
        "Upload-Metadata": encodeUploadMetadata(destPath),
      },
    });

    if (!create.ok) {
      throw new Error(`upload create failed: HTTP ${create.status}`);
    }

    const location = create.headers.get("location");
    if (!location) {
      throw new Error("upload create missing location header");
    }

    const uploadId = location.split("/").pop() ?? location;
    let offset = await headUploadOffset(location);

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + UPLOAD_CHUNK_SIZE);
      const patch = await apiFetch(location, {
        method: "PATCH",
        headers: {
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
        },
        body: chunk,
      });

      if (!patch.ok) {
        offset = await headUploadOffset(location);
        if (offset >= file.size) {
          break;
        }
        continue;
      }

      offset = Number(patch.headers.get("Upload-Offset") ?? String(offset + chunk.size));
      onProgress?.({ id: uploadId, offset, length: file.size });
    }
  }

  async runAction(actionId: string, paths: string[]): Promise<void> {
    const response = await apiFetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, action_id: actionId }),
    });
    if (!response.ok) {
      throw new Error(`action failed: HTTP ${response.status}`);
    }
  }

  async listContextActions(path: string): Promise<ContextMenuAction[]> {
    const response = await apiFetch(`/api/actions?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as ContextMenuAction[];
  }

  async fetchHealth(): Promise<HealthInfo | null> {
    const response = await apiFetch("/api/health");
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as HealthInfo;
  }

  async listPlugins(): Promise<PluginInfo[]> {
    const response = await apiFetch("/api/plugins");
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as PluginInfo[];
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

export { encodePathForQuery };
