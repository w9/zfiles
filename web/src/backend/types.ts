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

export type PluginInfo = {
  name: string;
  capabilities: string[];
  globs: string[];
  viewerModule?: string | null;
  trusted?: boolean;
};

export type ContextMenuAction = {
  id: string;
  label: string;
};

export type HealthInfo = {
  read_only?: boolean;
  follow_symlinks_outside_root?: boolean;
};

export type BackendEvent =
  | { type: "connected"; version: string; read_only?: boolean }
  | { type: "filesystem_changed"; path: string }
  | { type: "upload_progress"; id: string; offset: number; length?: number }
  | { type: "plugin_ready"; name: string }
  | { type: "listing_enrichment"; path: string; entries: FileEntry[] }
  | { type: "thumbnail_ready"; path: string; url: string };

export type BackendStatus = "connecting" | "connected" | "offline";

export interface ExplorerBackend {
  readonly mode: BackendMode;

  list(path: string, cursor?: string): Promise<ListResult>;
  stat(path: string): Promise<FileStat>;
  downloadUrl(path: string): string;
  thumbnailUrl(path: string, tier?: string): string;
  previewText(path: string): Promise<string | null>;
  upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<void>;
  runAction(actionId: string, paths: string[]): Promise<void>;
  listContextActions(path: string): Promise<ContextMenuAction[]>;
  fetchHealth(): Promise<HealthInfo | null>;
  listPlugins(): Promise<PluginInfo[]>;
  search(query: string, path: string): Promise<FileEntry[]>;
  subscribe(
    onEvent: (event: BackendEvent) => void,
    onStatus?: (status: BackendStatus) => void,
  ): () => void;
}
