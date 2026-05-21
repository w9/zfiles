import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PreviewPane from "./PreviewPane";
import VirtualListing, { type ListingEntry } from "./VirtualListing";
import { uploadFileResumable, type UploadProgress } from "./upload";

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
};

type KernelEvent =
  | { type: "connected"; version: string }
  | { type: "filesystem_changed"; path: string }
  | { type: "upload_progress"; id: string; offset: number; length?: number }
  | { type: "plugin_ready"; name: string }
  | { type: "listing_enrichment"; path: string; entries: FileEntry[] };

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
  const [readyPlugins, setReadyPlugins] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const loadListing = useCallback(async (path: string) => {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    const response = await fetch(`/api/list${query}`);
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
    setError(null);
  }, []);

  const loadPlugins = useCallback(async () => {
    const response = await fetch("/api/plugins");
    if (!response.ok) {
      return;
    }
    const plugins: PluginInfo[] = await response.json();
    setReadyPlugins(plugins.map((plugin) => plugin.name));
    setSearcherReady(
      plugins.some((plugin) => plugin.capabilities.includes("searcher")),
    );
  }, []);

  useEffect(() => {
    loadListing("").catch((err: Error) => setError(err.message));
    void loadPlugins();
  }, [loadListing, loadPlugins]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as KernelEvent;
      switch (event.type) {
        case "connected":
          setKernelVersion(event.version);
          break;
        case "filesystem_changed":
          loadListing(currentPath).catch((err: Error) => setError(err.message));
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
          if (event.path === currentPath) {
            setEntries((current) => mergeEntries(current, event.entries));
          }
          break;
      }
    };

    return () => socket.close();
  }, [currentPath, loadListing, loadPlugins]);

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
      fetch(`/api/search?${params.toString()}`)
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
        onSelect: () => {
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
      rows.push({
        key: entry.path,
        name: entry.name,
        path: entry.path,
        isDir: entry.is_dir,
        size: entry.is_dir ? undefined : entry.size,
        extraLabel: extraLabel(entry.extra),
        onSelect: () => setSelectedPath(entry.path),
        onActivate: () => {
          if (entry.is_dir) {
            navigateTo(entry.path);
          } else {
            setSelectedPath(entry.path);
          }
        },
        href: entry.is_dir
          ? undefined
          : `/api/file?path=${encodeURIComponent(entry.path)}`,
      });
    }
    return rows;
  }, [visibleEntries, currentPath, searchResults, navigateTo]);

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
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activateSelected,
    currentPath,
    listingEntries.length,
    navigateTo,
    searcherReady,
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

  return (
    <main className="shell">
      <header>
        <h1>zfiles</h1>
        {kernelVersion ? <p className="meta">kernel v{kernelVersion}</p> : null}
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

      <p className="meta">Shortcuts: j/k move, Enter open, Backspace up, / search</p>

      <div className="explorer-layout">
        <VirtualListing entries={listingEntries} selectedIndex={selectedIndex} />
        <PreviewPane path={selectedPath} />
      </div>
    </main>
  );
}
