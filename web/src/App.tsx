import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "./api";
import ContextMenu, { type ContextMenuAction } from "./ContextMenu";
import BackendStatus from "./BackendStatus";
import PreviewPane from "./PreviewPane";
import VirtualListing, { type ListingEntry } from "./VirtualListing";
import { uploadFileResumable, type UploadProgress } from "./upload";
import { useBackendStatus, type KernelEvent } from "./useBackendStatus";

type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extra?: Record<string, unknown>;
};

type PluginInfo = {
  name: string;
  capabilities: string[];
  globs: string[];
  viewerModule?: string | null;
  trusted?: boolean;
};

type ContextMenuState = {
  x: number;
  y: number;
  path: string;
  actions: ContextMenuAction[];
};

function mergeEntries(current: FileEntry[], incoming: FileEntry[]): FileEntry[] {
  const byPath = new Map(current.map((entry) => [entry.path, entry]));
  for (const entry of incoming) {
    const existing = byPath.get(entry.path);
    byPath.set(entry.path, existing ? { ...existing, ...entry } : entry);
  }
  return Array.from(byPath.values());
}

function extraLabel(extra?: Record<string, unknown>): string | undefined {
  if (!extra) {
    return undefined;
  }
  if (typeof extra.plugin === "string") {
    return `[${extra.plugin}]`;
  }
  return undefined;
}

function matchesGlob(glob: string, name: string): boolean {
  if (glob === "*") {
    return true;
  }
  if (glob.startsWith("*.")) {
    const ext = glob.slice(2);
    return name.endsWith(`.${ext}`) || name === ext;
  }
  return glob === name;
}

function thumbnailEligible(plugins: PluginInfo[], path: string): boolean {
  if (!plugins.some((plugin) => plugin.capabilities.includes("thumbnailer"))) {
    return false;
  }
  const name = path.split("/").pop() ?? path;
  return plugins.some(
    (plugin) =>
      plugin.capabilities.includes("thumbnailer") &&
      plugin.globs.some((glob) => matchesGlob(glob, name)),
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [kernelVersion, setKernelVersion] = useState<string | null>(null);
  const [searcherReady, setSearcherReady] = useState(false);
  const [thumbnailerReady, setThumbnailerReady] = useState(false);
  const [readyPlugins, setReadyPlugins] = useState<string[]>([]);
  const [pluginDetails, setPluginDetails] = useState<PluginInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [readyThumbnails, setReadyThumbnails] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectionAnchorRef = useRef(0);
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const loadListing = useCallback(async (path: string) => {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    const response = await apiFetch(`/api/list${query}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: FileEntry[] = await response.json();
    setEntries(data);
    setCurrentPath(path);
    setSearchResults(null);
    setSearchQuery("");
    setSelectedIndex(0);
    setSelectedPath(null);
    setSelectedPaths(new Set());
    setReadyThumbnails(new Map());
    setError(null);
  }, []);

  const loadPlugins = useCallback(async () => {
    const response = await apiFetch("/api/plugins");
    if (!response.ok) {
      return;
    }
    const plugins: PluginInfo[] = await response.json();
    setPluginDetails(plugins);
    setReadyPlugins(plugins.map((plugin) => plugin.name));
    setSearcherReady(
      plugins.some((plugin) => plugin.capabilities.includes("searcher")),
    );
    setThumbnailerReady(
      plugins.some((plugin) => plugin.capabilities.includes("thumbnailer")),
    );
  }, []);

  useEffect(() => {
    loadListing("").catch((err: Error) => setError(err.message));
    void loadPlugins();
  }, [loadListing, loadPlugins]);

  const handleKernelEvent = useCallback(
    (event: KernelEvent) => {
      switch (event.type) {
        case "connected":
          setKernelVersion(event.version);
          break;
        case "filesystem_changed":
          loadListing(currentPathRef.current).catch((err: Error) =>
            setError(err.message),
          );
          break;
        case "upload_progress":
          setUploadProgress({
            id: event.id,
            offset: event.offset,
            length: event.length,
          });
          break;
        case "plugin_ready":
          setReadyPlugins((current) =>
            current.includes(event.name) ? current : [...current, event.name],
          );
          void loadPlugins();
          break;
        case "listing_enrichment":
          if (event.path === currentPathRef.current) {
            setEntries((current) =>
              mergeEntries(current, event.entries as FileEntry[]),
            );
          }
          break;
        case "thumbnail_ready":
          setReadyThumbnails((current) => {
            const next = new Map(current);
            next.set(event.path, event.url);
            return next;
          });
          break;
      }
    },
    [loadListing, loadPlugins],
  );

  const backendStatus = useBackendStatus(handleKernelEvent);

  useEffect(() => {
    if (!searcherReady || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ q: searchQuery.trim() });
      if (currentPath) {
        params.set("path", currentPath);
      }
      apiFetch(`/api/search?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json() as Promise<FileEntry[]>;
        })
        .then((results) => {
          setSearchResults(results);
          setSelectedIndex(0);
          setSelectedPath(results[0]?.path ?? null);
          setSelectedPaths(new Set());
        })
        .catch((err: Error) => setError(err.message));
    }, 200);

    return () => window.clearTimeout(handle);
  }, [searchQuery, currentPath, searcherReady]);

  const navigateTo = useCallback(
    (path: string) => {
      loadListing(path).catch((err: Error) => setError(err.message));
    },
    [loadListing],
  );

  const openContextMenu = useCallback(
    async (event: React.MouseEvent, path: string) => {
      event.preventDefault();
      const response = await apiFetch(`/api/actions?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        return;
      }
      const actions = (await response.json()) as ContextMenuAction[];
      if (actions.length === 0) {
        return;
      }
      setContextMenu({ x: event.clientX, y: event.clientY, path, actions });
    },
    [],
  );

  const runBulkAction = useCallback(async (actionId: string, paths: string[]) => {
    const response = await apiFetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, action_id: actionId }),
    });
    if (!response.ok) {
      setError(`Action failed: HTTP ${response.status}`);
      return;
    }
    if (actionId === "copy-path") {
      await navigator.clipboard.writeText(paths.join("\n"));
    }
  }, []);

  const runContextAction = useCallback(
    async (actionId: string, path: string) => {
      await runBulkAction(actionId, [path]);
    },
    [runBulkAction],
  );

  const toggleMultiSelect = useCallback((path: string) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const breadcrumbs = currentPath ? ["", ...currentPath.split("/")] : [""];
  const visibleEntries = searchResults ?? entries;

  const listingEntries = useMemo<ListingEntry[]>(() => {
    const rows: ListingEntry[] = [];
    if (!searchResults && currentPath) {
      rows.push({
        key: "..",
        name: "..",
        path: "",
        isDir: true,
        onSelect: (_event: React.MouseEvent) => {
          setSelectedIndex(0);
          setSelectedPath(null);
        },
        onActivate: () => {
          const parent = currentPath.split("/").slice(0, -1).join("/");
          navigateTo(parent);
        },
      });
    }

    for (const entry of visibleEntries) {
      const currentIndex = rows.length;
      const thumbReady = readyThumbnails.get(entry.path);
      rows.push({
        key: entry.path,
        name: entry.name,
        path: entry.path,
        isDir: entry.is_dir,
        size: entry.is_dir ? undefined : entry.size,
        extraLabel: extraLabel(entry.extra),
        thumbnailUrl:
          !entry.is_dir &&
          thumbnailerReady &&
          thumbnailEligible(pluginDetails, entry.path) &&
          thumbReady
            ? thumbReady
            : undefined,
        onSelect: (event) => {
          if (event.shiftKey) {
            const anchor = selectionAnchorRef.current;
            const start = Math.min(anchor, currentIndex);
            const end = Math.max(anchor, currentIndex);
            setSelectedPaths(() => {
              const next = new Set<string>();
              for (let i = start; i <= end; i += 1) {
                const row = rows[i];
                if (row?.path && row.key !== "..") {
                  next.add(row.path);
                }
              }
              return next;
            });
          } else {
            selectionAnchorRef.current = currentIndex;
          }
          setSelectedIndex(currentIndex);
          setSelectedPath(entry.path);
        },
        onActivate: () => {
          if (entry.is_dir) {
            navigateTo(entry.path);
          } else {
            setSelectedPath(entry.path);
          }
        },
        onContextMenu: (event) => void openContextMenu(event, entry.path),
        href: entry.is_dir
          ? undefined
          : `/api/file?path=${encodeURIComponent(entry.path)}`,
      });
    }
    return rows;
  }, [
    visibleEntries,
    currentPath,
    searchResults,
    navigateTo,
    thumbnailerReady,
    pluginDetails,
    readyThumbnails,
    openContextMenu,
  ]);

  useEffect(() => {
    const selected = listingEntries[selectedIndex];
    if (selected && !selected.isDir) {
      setSelectedPath(selected.path);
    }
  }, [selectedIndex, listingEntries]);

  const activateSelected = useCallback(() => {
    const selected = listingEntries[selectedIndex];
    if (selected) {
      selected.onActivate();
    }
  }, [listingEntries, selectedIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (event.key === "/" && !typing && searcherReady) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (typing) {
        return;
      }

      if (event.key === "j") {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, listingEntries.length - 1));
      } else if (event.key === "k") {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        activateSelected();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        if (currentPath) {
          const parent = currentPath.split("/").slice(0, -1).join("/");
          navigateTo(parent);
        }
      } else if (event.key === " ") {
        event.preventDefault();
        const selected = listingEntries[selectedIndex];
        if (selected?.path && selected.key !== "..") {
          toggleMultiSelect(selected.path);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activateSelected,
    currentPath,
    listingEntries,
    listingEntries.length,
    navigateTo,
    searcherReady,
    selectedIndex,
    toggleMultiSelect,
  ]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) {
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(null);

    try {
      for (const file of files) {
        const target = currentPath ? `${currentPath}/${file.name}` : file.name;
        await uploadFileResumable(file, target, setUploadProgress);
      }
      await loadListing(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const uploadLabel = uploading
    ? uploadProgress?.length
      ? `Uploading… ${Math.round((uploadProgress.offset / uploadProgress.length) * 100)}%`
      : "Uploading…"
    : "Drop files here to upload";

  const bulkDownloadPaths = Array.from(selectedPaths);

  return (
    <main className="shell">
      <header>
        <div className="header-top">
          <h1>zfiles</h1>
          <BackendStatus status={backendStatus} kernelVersion={kernelVersion} />
        </div>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((part, index) => {
            const path = breadcrumbs.slice(1, index + 1).join("/");
            const label = index === 0 ? "root" : part;
            return (
              <button
                key={`${part}-${index}`}
                type="button"
                className="crumb"
                onClick={() => navigateTo(path)}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      {searcherReady ? (
        <section className="search">
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search filenames… (press /)"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </section>
      ) : null}

      <section
        className="dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onUpload(event.dataTransfer.files);
        }}
      >
        <p>{uploadLabel}</p>
        <label className="upload-button">
          Choose files
          <input
            type="file"
            multiple
            hidden
            onChange={(event) => void onUpload(event.target.files)}
          />
        </label>
      </section>

      {readyPlugins.length > 0 ? (
        <p className="meta">Plugins ready: {readyPlugins.join(", ")}</p>
      ) : null}

      {error && <p className="error">{error}</p>}

      {bulkDownloadPaths.length > 0 ? (
        <section className="selection-bar" aria-label="Multi-selection actions">
          <span>{bulkDownloadPaths.length} selected</span>
          <div className="selection-links">
            {bulkDownloadPaths.map((path) => (
              <a
                key={path}
                href={`/api/file?path=${encodeURIComponent(path)}`}
                download
              >
                Download {path.split("/").pop()}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void runBulkAction("copy-path", bulkDownloadPaths)}
          >
            Copy paths
          </button>
          <button type="button" onClick={() => setSelectedPaths(new Set())}>
            Clear
          </button>
        </section>
      ) : null}

      <p className="meta">
        Shortcuts: j/k move, Enter open, Backspace up, / search, Space toggle, Shift+click range
      </p>

      <div className="explorer-layout">
        <VirtualListing
          entries={listingEntries}
          selectedIndex={selectedIndex}
          multiSelectedPaths={selectedPaths}
        />
        <PreviewPane path={selectedPath} plugins={pluginDetails} />
      </div>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenu.actions}
          onSelect={(actionId) => runContextAction(actionId, contextMenu.path)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </main>
  );
}
