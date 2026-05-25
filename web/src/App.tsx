import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ExplorerBreadcrumb from "./ExplorerBreadcrumb";
import ContextMenu, { type ContextMenuAction } from "./ContextMenu";
import StatusBar from "./StatusBar";
import ThemeToggle from "./ThemeToggle";
import ListingViewToggle from "./ListingViewToggle";
import { apiFetch } from "./api";
import PreviewPane from "./PreviewPane";
import VirtualListing, { type ListingEntry } from "./VirtualListing";
import GridListing from "./GridListing";
import SlideshowDialog from "./SlideshowDialog";
import { uploadFileResumable, type UploadProgress } from "./upload";
import { useTranslation, type MessageKey } from "./i18n";
import { loadPluginCatalogs } from "./i18n/pluginCatalog";
import { useBackendStatus, type KernelEvent } from "./useBackendStatus";
import { useTheme } from "./useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import CommandPalette from "./actions/CommandPalette";
import { ActionArgPromptDialog, ActionConfirmDialog } from "./actions/ActionDialogs";
import MenuBar from "./actions/MenuBar";
import ActionToolbar from "./actions/ActionToolbar";
import { actionsForContext } from "./actions/dispatch";
import { type ContextKeys } from "./actions/contextKeys";
import { useActionSystem } from "./actions/useActionSystem";
import { isImagePath, matchesGlob } from "./imagePaths";
import {
  readListingViewMode,
  type ListingViewMode,
} from "./listingView";
import {
  selectedRowIndexForPath,
  shouldRefreshListing,
} from "./listingRefresh";
import { notifyApiError, notifyError } from "./notifyError";
import { setViewerBridge, clearViewerBridge, type ViewerBridge } from "./viewerBridge";
import { Toaster } from "@/components/ui/sonner";

type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: unknown;
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
  const { t, locale } = useTranslation();
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [kernelVersion, setKernelVersion] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [searcherReady, setSearcherReady] = useState(false);
  const [thumbnailerReady, setThumbnailerReady] = useState(false);
  const [pluginDetails, setPluginDetails] = useState<PluginInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [readyThumbnails, setReadyThumbnails] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [focusPane, setFocusPane] = useState<"file-list" | "search-input" | "preview">(
    "file-list",
  );
  const [listingViewMode, setListingViewMode] = useState<ListingViewMode>(() =>
    readListingViewMode(),
  );
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowPaths, setSlideshowPaths] = useState<string[]>([]);
  const [slideshowStartPath, setSlideshowStartPath] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectionAnchorRef = useRef(0);
  const currentPathRef = useRef(currentPath);
  const listingEntriesRef = useRef<ListingEntry[]>([]);
  const selectedIndexRef = useRef(selectedIndex);
  const selectedPathsRef = useRef(selectedPaths);
  const selectedPathRef = useRef(selectedPath);
  const openContextMenuRef = useRef<(event: React.MouseEvent, path: string) => void>(() => {});
  currentPathRef.current = currentPath;
  selectedIndexRef.current = selectedIndex;
  selectedPathsRef.current = selectedPaths;
  selectedPathRef.current = selectedPath;

  const loadListing = useCallback(async (path: string, options?: { preserveSelection?: boolean }) => {
    const previousPath = options?.preserveSelection ? selectedPathRef.current : null;
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    const response = await apiFetch(`/api/list${query}`);
    if (!response.ok) {
      await notifyApiError(response, t);
      return;
    }
    const data: FileEntry[] = await response.json();
    setEntries(data);
    setCurrentPath(path);
    setSearchResults(null);
    setSearchQuery("");
    const restoredIndex =
      previousPath != null
        ? selectedRowIndexForPath(path, data, previousPath)
        : null;
    if (restoredIndex != null) {
      setSelectedIndex(restoredIndex);
      setSelectedPath(previousPath);
      setSelectedPaths(new Set());
    } else {
      setSelectedIndex(0);
      setSelectedPath(null);
      setSelectedPaths(new Set());
    }
    setReadyThumbnails((current) => {
      const visiblePaths = new Set(
        data.filter((entry) => !entry.is_dir).map((entry) => entry.path),
      );
      const next = new Map<string, string>();
      for (const [entryPath, url] of current) {
        if (visiblePaths.has(entryPath)) {
          next.set(entryPath, url);
        }
      }
      return next;
    });
  }, [t]);

  const loadPlugins = useCallback(async () => {
    const response = await apiFetch("/api/plugins");
    if (!response.ok) {
      return;
    }
    const plugins: PluginInfo[] = await response.json();
    setPluginDetails(plugins);
    setSearcherReady(
      plugins.some((plugin) => plugin.capabilities.includes("searcher")),
    );
    setThumbnailerReady(
      plugins.some((plugin) => plugin.capabilities.includes("thumbnailer")),
    );
  }, []);

  useEffect(() => {
    loadListing("").catch((err: Error) => notifyError(err.message));
    void loadPlugins();
    void loadPluginCatalogs();
    void apiFetch("/api/health")
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { read_only?: boolean };
        setReadOnly(data.read_only ?? false);
      })
      .catch(() => {});
  }, [loadListing, loadPlugins]);

  const handleKernelEvent = useCallback(
    (event: KernelEvent) => {
      switch (event.type) {
        case "connected":
          setKernelVersion(event.version);
          setReadOnly(event.read_only ?? false);
          break;
        case "filesystem_changed": {
          if (
            !shouldRefreshListing(event.path, currentPathRef.current)
          ) {
            break;
          }
          loadListing(currentPathRef.current, { preserveSelection: true }).catch(
            (err: Error) => notifyError(err.message),
          );
          break;
        }
        case "upload_progress":
          setUploadProgress({
            id: event.id,
            offset: event.offset,
            length: event.length,
          });
          break;
        case "plugin_ready":
          void loadPlugins().then(() => {
            if (event.name === "image-thumbnailer") {
              loadListing(currentPathRef.current, { preserveSelection: true }).catch(
                (err: Error) => notifyError(err.message),
              );
            }
          });
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
  const { mode: themeMode, resolved: resolvedTheme, setMode: setThemeMode } = useTheme();

  const contextKeys = useMemo<ContextKeys>(
    () => ({
      "focus.pane": focusPane,
      "selection.count": selectedPaths.size,
      "selection.paths": Array.from(selectedPaths),
      "current-path": currentPath,
      "searcher.ready": searcherReady,
      "connection.online": backendStatus === "connected",
      "server.read-only": readOnly,
      "preview.is-image": selectedPath ? isImagePath(selectedPath) : false,
      "preview.path": selectedPath ?? "",
    }),
    [focusPane, selectedPaths, currentPath, searcherReady, backendStatus, readOnly, selectedPath],
  );

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
            await notifyApiError(response, t);
            return;
          }
          return response.json() as Promise<FileEntry[]>;
        })
        .then((results) => {
          if (!results) {
            return;
          }
          setSearchResults(results);
          setSelectedIndex(0);
          setSelectedPath(results[0]?.path ?? null);
          setSelectedPaths(new Set());
        })
        .catch((err: Error) => notifyError(err.message));
    }, 200);

    return () => window.clearTimeout(handle);
  }, [searchQuery, currentPath, searcherReady, t]);

  const navigateTo = useCallback(
    (path: string) => {
      loadListing(path).catch((err: Error) => notifyError(err.message));
    },
    [loadListing],
  );

  const runBulkAction = useCallback(
    async (actionId: string, paths: string[]) => {
      const response = await apiFetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths, action_id: actionId }),
      });
      if (!response.ok) {
        notifyError(t("error.actionFailed", { status: String(response.status) }));
        return;
      }
      if (actionId === "copy-path") {
        await navigator.clipboard.writeText(paths.join("\n"));
      }
      if (actionId === "file.delete") {
        setSelectedPaths(new Set());
        setSelectedPath(null);
        await loadListing(currentPathRef.current);
      }
    },
    [t, loadListing],
  );

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

  const actionLabel = useCallback(
    (key: string) => t(key as MessageKey),
    [t],
  );

  const getImagePaths = useCallback(() => {
    const selected = Array.from(selectedPathsRef.current);
    if (selected.length > 0) {
      return selected.filter(isImagePath);
    }
    return listingEntriesRef.current
      .filter((entry) => entry.key !== ".." && !entry.isDir && isImagePath(entry.path))
      .map((entry) => entry.path);
  }, []);

  const openSlideshow = useCallback((paths: string[], startPath: string | null) => {
    setSlideshowPaths(paths);
    setSlideshowStartPath(startPath);
    setSlideshowOpen(true);
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
        modified: entry.modified,
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
        onContextMenu: (event) => void openContextMenuRef.current(event, entry.path),
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
  ]);

  useEffect(() => {
    listingEntriesRef.current = listingEntries;
  }, [listingEntries]);

  const activateSelected = useCallback(() => {
    const selected = listingEntriesRef.current[selectedIndexRef.current];
    if (selected) {
      selected.onActivate();
    }
  }, []);

  const actionSystem = useActionSystem(
    contextKeys,
    {
      getListingLength: () => listingEntriesRef.current.length,
      getSelectedIndex: () => selectedIndexRef.current,
      getSelectedPaths: () => Array.from(selectedPathsRef.current),
      getCurrentPath: () => currentPathRef.current,
      setSelectedIndex,
      activateSelected,
      navigateTo,
      toggleMultiSelect,
      clearSelection: () => setSelectedPaths(new Set()),
      focusSearch: () => {
        setFocusPane("search-input");
        searchInputRef.current?.focus();
      },
      runBulkAction,
      getListingPathAt: (index: number) => {
        const row = listingEntriesRef.current[index];
        return row?.path && row.key !== ".." ? row.path : null;
      },
    },
    () => ({
      getImagePaths,
      getCurrentPreviewPath: () => selectedPathRef.current,
      setPreviewPath: (path: string) => {
        const index = listingEntriesRef.current.findIndex((entry) => entry.path === path);
        if (index >= 0) {
          setSelectedIndex(index);
        }
        setSelectedPath(path);
        setFocusPane("preview");
      },
      openSlideshow,
      runBulkAction,
    }),
  );

  const handlePreviewDispatch = useCallback(
    (actionId: string) => {
      void actionSystem.invoke(actionId);
    },
    [actionSystem],
  );

  const handleRegisterViewerBridge = useCallback((bridge: ViewerBridge) => {
    setViewerBridge(bridge);
  }, []);

  const openContextMenu = useCallback(
    async (event: React.MouseEvent, path: string) => {
      event.preventDefault();
      const response = await apiFetch(`/api/actions?path=${encodeURIComponent(path)}`);
      const pluginActions: ContextMenuAction[] = response.ok
        ? ((await response.json()) as ContextMenuAction[])
        : [];
      const builtinActions = actionsForContext(
        actionSystem.registry.list(),
        "file-list",
        contextKeys,
      ).map((action) => ({
        id: action.id,
        label: actionLabel(action.nameKey),
      }));
      const seen = new Set<string>();
      const actions = [...pluginActions, ...builtinActions].filter((action) => {
        if (seen.has(action.id)) {
          return false;
        }
        seen.add(action.id);
        return true;
      });
      if (actions.length === 0) {
        return;
      }
      setContextMenu({ x: event.clientX, y: event.clientY, path, actions });
    },
    [actionSystem.registry, actionLabel, contextKeys],
  );
  openContextMenuRef.current = openContextMenu;

  useEffect(() => {
    const selected = listingEntries[selectedIndex];
    if (selected && !selected.isDir) {
      setSelectedPath(selected.path);
    }
  }, [selectedIndex, listingEntries]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) {
      return;
    }

    setUploading(true);
    setUploadProgress(null);

    try {
      for (const file of files) {
        const target = currentPath ? `${currentPath}/${file.name}` : file.name;
        await uploadFileResumable(file, target, setUploadProgress);
      }
      await loadListing(currentPath);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t("error.uploadFailed"));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const uploadLabel = uploading
    ? uploadProgress?.length
      ? t("upload.uploadingProgress", {
          percent: String(
            Math.round((uploadProgress.offset / uploadProgress.length) * 100),
          ),
        })
      : t("upload.uploading")
    : t("upload.drop");

  const bulkDownloadPaths = Array.from(selectedPaths);

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MenuBar
            registry={actionSystem.registry}
            contextKeys={contextKeys}
            keybindings={actionSystem.keybindings}
            labelForKey={actionLabel}
            invoke={(id) => void actionSystem.invoke(id)}
            ariaLabel={t("actions.menuBar.label")}
          />
          <div className="flex flex-wrap items-center gap-2">
            {searcherReady ? (
              <Input
                ref={searchInputRef}
                type="search"
                className="h-8 w-44 shrink-0"
                placeholder={t("search.placeholderShort")}
                title={t("search.placeholder")}
                aria-label={t("search.placeholder")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setFocusPane("search-input")}
                onBlur={() => setFocusPane("file-list")}
              />
            ) : null}
            <ListingViewToggle
              mode={listingViewMode}
              onChange={setListingViewMode}
            />
            <ThemeToggle mode={themeMode} onChange={setThemeMode} />
            <ActionToolbar
              registry={actionSystem.registry}
              contextKeys={contextKeys}
              keybindings={actionSystem.keybindings}
              labelForKey={actionLabel}
              invoke={(id) => void actionSystem.invoke(id)}
              ariaLabel={t("actions.toolbar.label")}
            />
          </div>
        </div>
      </header>

      <section
        className={cn(
          "mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-border bg-card p-4",
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onUpload(event.dataTransfer.files);
        }}
      >
        <p className="text-sm text-muted-foreground">{uploadLabel}</p>
        <Button variant="secondary" asChild>
          <label className="cursor-pointer">
            {t("upload.chooseFiles")}
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => void onUpload(event.target.files)}
            />
          </label>
        </Button>
      </section>

      {bulkDownloadPaths.length > 0 ? (
        <section
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
          aria-label={t("selection.count", { count: String(bulkDownloadPaths.length) })}
        >
          <span className="text-sm font-medium">
            {t("selection.count", { count: String(bulkDownloadPaths.length) })}
          </span>
          <div className="flex flex-wrap gap-2">
            {bulkDownloadPaths.map((path) => (
              <a
                key={path}
                className="text-sm text-primary underline-offset-4 hover:underline"
                href={`/api/file?path=${encodeURIComponent(path)}`}
                download
              >
                {t("selection.download", { name: path.split("/").pop() ?? path })}
              </a>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void actionSystem.invoke("selection.copy-paths")}
          >
            {t("selection.copyPaths")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void actionSystem.invoke("selection.clear")}
          >
            {t("selection.clear")}
          </Button>
        </section>
      ) : null}

      <section className="mt-4 flex flex-col overflow-hidden rounded-xl border bg-card">
        <div className="shrink-0 border-b px-3 py-2">
          <ExplorerBreadcrumb
            parts={breadcrumbs}
            rootLabel={t("breadcrumb.root")}
            ariaLabel={t("breadcrumb.label")}
            onNavigate={navigateTo}
          />
        </div>
        <div className="grid h-[440px] grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
          <div className="h-full min-h-0 min-w-0 overflow-hidden">
            {listingViewMode === "grid" ? (
              <GridListing
                entries={listingEntries}
                selectedIndex={selectedIndex}
                multiSelectedPaths={selectedPaths}
                ariaLabel={t("listing.label")}
                iconTheme={resolvedTheme}
                listingAtRoot={!currentPath}
                className="h-full rounded-none border-0 shadow-none"
              />
            ) : (
              <VirtualListing
                entries={listingEntries}
                selectedIndex={selectedIndex}
                multiSelectedPaths={selectedPaths}
                ariaLabel={t("listing.label")}
                iconTheme={resolvedTheme}
                listingAtRoot={!currentPath}
                className="h-full rounded-none border-0 shadow-none"
                columnLabels={{
                  name: t("listing.column.name"),
                  type: t("listing.column.type"),
                  size: t("listing.column.size"),
                  modified: t("listing.column.modified"),
                  typeDirectory: t("listing.type.directory"),
                  typeFile: t("listing.type.file"),
                  locale: locale === "zh-CN" ? "zh-CN" : "en",
                }}
              />
            )}
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-t border-border lg:border-t-0 lg:border-l">
            <PreviewPane
              path={selectedPath}
              plugins={pluginDetails}
              theme={resolvedTheme}
              onFocusPreview={() => setFocusPane("preview")}
              onDispatch={handlePreviewDispatch}
              onRegisterBridge={handleRegisterViewerBridge}
              className="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent shadow-none"
            />
          </div>
        </div>
        <StatusBar
          backendStatus={backendStatus}
          kernelVersion={kernelVersion}
          className="shrink-0 rounded-none border-0 border-t shadow-none"
        />
      </section>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenu.actions}
          ariaLabel={t("contextMenu.label")}
          onSelect={(actionId) => {
            if (actionSystem.registry.get(actionId)) {
              void actionSystem.invoke(actionId);
            } else {
              void runContextAction(actionId, contextMenu.path);
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      <CommandPalette
        open={actionSystem.paletteOpen}
        onOpenChange={actionSystem.setPaletteOpen}
        registry={actionSystem.registry}
        contextKeys={contextKeys}
        dispatch={(id, options) => actionSystem.invoke(id, options)}
        keybindings={actionSystem.keybindings}
        title={t("actions.palette.title")}
        placeholder={t("actions.palette.placeholder")}
        emptyLabel={t("actions.palette.empty")}
        argPromptTitle={t("actions.palette.argPromptTitle")}
        argPromptPlaceholder={t("actions.palette.argPromptPlaceholder")}
        labelForKey={actionLabel}
      />

      <ActionConfirmDialog
        action={actionSystem.confirmState?.action ?? null}
        title={t("actions.confirm.title")}
        cancelLabel={t("actions.confirm.cancel")}
        confirmLabel={t("actions.confirm.confirm")}
        message={
          actionSystem.confirmState?.action.confirmMessageKey
            ? t(actionSystem.confirmState.action.confirmMessageKey as MessageKey)
            : actionSystem.confirmState
              ? t("actions.confirm.defaultMessage", {
                  name: actionLabel(actionSystem.confirmState.action.nameKey),
                })
              : ""
        }
        onCancel={() => actionSystem.dismissConfirm(false)}
        onConfirm={() => actionSystem.dismissConfirm(true)}
      />

      <ActionArgPromptDialog
        action={actionSystem.argPromptState?.action ?? null}
        schema={actionSystem.argPromptState?.schema ?? null}
        title={t("actions.palette.argPromptTitle")}
        placeholder={t("actions.palette.argPromptPlaceholder")}
        cancelLabel={t("actions.confirm.cancel")}
        continueLabel={t("actions.palette.continue")}
        value={actionSystem.argPromptValue}
        onValueChange={actionSystem.setArgPromptValue}
        onCancel={() => actionSystem.dismissArgPrompt(null)}
        onSubmit={() => actionSystem.dismissArgPrompt(actionSystem.argPromptValue)}
      />

      <SlideshowDialog
        open={slideshowOpen}
        paths={slideshowPaths}
        startPath={slideshowStartPath}
        onOpenChange={setSlideshowOpen}
      />

      <Toaster richColors closeButton position="bottom-right" />
    </main>
  );
}
