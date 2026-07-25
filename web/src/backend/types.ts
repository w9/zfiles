import type { RunActionParams } from "./runActionParams";

export type BackendMode = "local" | "s3" | "browser";

export type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink?: boolean;
  size: number;
  modified?: unknown;
  extra?: Record<string, unknown>;
};

export type FileStat = {
  path: string;
  is_dir: boolean;
  is_symlink?: boolean;
  symlink_target?: string;
  size: number;
  modified?: unknown;
  extra?: Record<string, unknown>;
};

export type UploadProgress = {
  id: string;
  offset: number;
  length?: number;
  multipartUploadId?: string;
  /** Bytes durably stored on the server (excludes in-flight part data). */
  committedOffset?: number;
};

export type TusUploadResume = {
  location: string;
  checksumSha256Base64: string;
};

export type UploadCallbacks = {
  onHashing?: () => void;
  onUploadStart?: () => void;
  onVerifying?: () => void;
  /** Local tus: emitted after upload create so pause/resume can skip re-hash. */
  onTransferSession?: (session: {
    backendUploadId: string;
    tusLocation: string;
    checksumSha256Base64: string;
  }) => void;
  /** Cloud S3: emitted after CreateMultipartUpload so the queue can persist resume metadata. */
  onMultipartSession?: (session: {
    uploadId: string;
    objectKey: string;
    partSize: number;
    checksumValidation: boolean;
    checksumSha256Base64?: string;
  }) => void;
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
    callbacks?: UploadCallbacks,
    tusResume?: TusUploadResume,
  ): Promise<void>;
  runAction(params: RunActionParams): Promise<void>;
  fetchHealth(): Promise<HealthInfo | null>;
  subscribe(
    onEvent: (event: BackendEvent) => void,
    onStatus?: (status: BackendStatus) => void,
  ): () => void;
}
