export type BackendMode = "local" | "s3";

export type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: unknown;
  extra?: Record<string, unknown>;
};

export type FileStat = {
  path: string;
  is_dir: boolean;
  size: number;
  modified?: unknown;
};

export type UploadProgress = {
  id: string;
  offset: number;
  length?: number;
};

export type ListResult = {
  entries: FileEntry[];
  nextCursor?: string;
};

export type HealthInfo = {
  read_only?: boolean;
  follow_symlinks_outside_root?: boolean;
};

export type BackendEvent =
  | { type: "connected"; version: string; read_only?: boolean }
  | { type: "filesystem_changed"; path: string }
  | { type: "upload_progress"; id: string; offset: number; length?: number };

export type BackendStatus = "connecting" | "connected" | "offline";

export interface ExplorerBackend {
  readonly mode: BackendMode;

  list(path: string, cursor?: string): Promise<ListResult>;
  stat(path: string): Promise<FileStat>;
  downloadUrl(path: string): string | Promise<string>;
  upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  runAction(actionId: string, paths: string[]): Promise<void>;
  fetchHealth(): Promise<HealthInfo | null>;
  subscribe(
    onEvent: (event: BackendEvent) => void,
    onStatus?: (status: BackendStatus) => void,
  ): () => void;
}
