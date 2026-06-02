import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SortingState } from "@tanstack/react-table";

import { Settings } from "lucide-react";

import ExplorerBreadcrumb from "../ExplorerBreadcrumb";
import ContextMenu, { type ContextMenuAction } from "../ContextMenu";
import StatusBar from "../StatusBar";
import LanguageToggle from "../LanguageToggle";
import ThemeToggle from "../ThemeToggle";
import ListingViewToggle from "../ListingViewToggle";
import PreviewPane from "../PreviewPane";
import VirtualListing, { type ListingEntry } from "../VirtualListing";
import GridListing from "../GridListing";
import SlideshowDialog from "../SlideshowDialog";
import { useExplorerBackend, type FileEntry } from "../backend";
import { useTranslation, type MessageKey } from "../i18n";
import { useBackendStatus, type BackendEvent } from "../useBackendStatus";
import { useTheme } from "../useTheme";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CommandPalette from "../actions/CommandPalette";
import { ActionArgPromptDialog, ActionConfirmDialog } from "../actions/ActionDialogs";
import MenuBar from "../actions/MenuBar";
import ActionToolbar from "../actions/ActionToolbar";
import { actionsForContext } from "../actions/dispatch";
import { type ContextKeys } from "../actions/contextKeys";
import { useActionSystem } from "../actions/useActionSystem";
import { isImagePath } from "../imagePaths";
import {
  readListingViewMode,
  type ListingViewMode,
} from "../listingView";
import {
  restoreSelectionFromListing,
  shouldRefreshListing,
} from "../listingRefresh";
import { notifyApiError, notifyError } from "../notifyError";
import UploadPanel from "../UploadPanel";
import UploadConflictDialog from "../UploadConflictDialog";
import UploadButton from "../UploadButton";
import { useUploadQueue } from "../upload-queue";
import { useGlobalFileDrop } from "../useGlobalFileDrop";
import { useAppRoute } from "../routing/AppRouteProvider";
import { useModifiedTimeFormat } from "../settings/ModifiedTimeFormatProvider";
import { useListingSortOrder } from "../settings/ListingSortOrderProvider";
import { useShowDotEntries } from "../settings/ShowDotEntriesProvider";
import ShowDotEntriesToggle from "../ShowDotEntriesToggle";
import { filterDotEntries } from "../listingFilter";
import { sortFileEntries } from "../listingSort";
import type { ListingColumnLabels } from "../listing-types";
import { useListingDisplayOrder } from "../useListingDisplayOrder";
import { useExplorerNavigation } from "./useExplorerNavigation";
import { explorerPathFromPathname } from "./explorerUrl";

type ContextMenuState = {
  x: number;
  y: number;
  path: string;
  actions: ContextMenuAction[];
};

export default function ExplorerApp() {
  const backend = useExplorerBackend();
  const { t, locale } = useTranslation();
  const { navigate } = useAppRoute();
  const { format: modifiedTimeFormat } = useModifiedTimeFormat();
  const { order: listingSortOrder } = useListingSortOrder();
  const { showDotEntries, toggleShowDotEntries } = useShowDotEntries();
  const initialPath = useMemo(
    () => explorerPathFromPathname(window.location.pathname),
    [],
  );
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [listCursor, setListCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [kernelVersion, setKernelVersion] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [focusPane, setFocusPane] = useState<"file-list" | "preview">("file-list");
  const [listingViewMode, setListingViewMode] = useState<ListingViewMode>(() =>
    readListingViewMode(),
  );
  const [columnSorting, setColumnSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowPaths, setSlideshowPaths] = useState<string[]>([]);
  const [slideshowStartPath, setSlideshowStartPath] = useState<string | null>(null);
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

  const loadListing = useCallback(async (path: string, options?: { preserveSelection?: boolean }): Promise<boolean> => {
    const previousPath = options?.preserveSelection ? selectedPathRef.current : null;
    const previousPaths = options?.preserveSelection
      ? selectedPathsRef.current.size > 0
        ? new Set(selectedPathsRef.current)
        : previousPath
          ? new Set([previousPath])
          : new Set<string>()
      : null;
    try {
      const { entries: data, nextCursor } = await backend.list(path);
      setEntries(data);
      setListCursor(nextCursor);
      setCurrentPath(path);
      const restored =
        previousPaths != null
          ? restoreSelectionFromListing(data, previousPaths, previousPath)
          : null;
      if (restored) {
        setSelectedIndex(restored.index);
        setSelectedPath(restored.focusPath);
        setSelectedPaths(restored.paths);
        selectionAnchorRef.current = restored.index;
      } else if (previousPaths != null && previousPaths.size > 0) {
        setSelectedIndex(0);
        setSelectedPath(null);
        setSelectedPaths(new Set());
      } else {
        setSelectedIndex(0);
        setSelectedPath(null);
        setSelectedPaths(new Set());
      }
      return true;
    } catch (err) {
      if (err instanceof Response) {
        await notifyApiError(err, t);
        return false;
      }
      notifyError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [backend, t]);

  const loadMoreEntries = useCallback(async () => {
    if (!listCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const { entries: data, nextCursor } = await backend.list(currentPathRef.current, listCursor);
      setEntries((current) => [...current, ...data]);
      setListCursor(nextCursor);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [backend, listCursor, loadingMore]);

  useEffect(() => {
    loadListing(initialPath).catch((err: Error) => notifyError(err.message));
    void backend
      .fetchHealth()
      .then((data) => {
        if (data) {
          setReadOnly(data.read_only ?? false);
        }
      })
      .catch(() => {});
  }, [backend, loadListing, initialPath]);

  const {
    items: uploadItems,
    enqueue: enqueueUploads,
    applyRemoteProgress,
    cancelUpload,
    resolveUploadConflict,
    clearFinished: clearFinishedUploads,
    conflictItem: uploadConflictItem,
  } = useUploadQueue({
    backend,
    readOnly,
    onItemComplete: () => {
      loadListing(currentPathRef.current, { preserveSelection: true }).catch(
        (err: Error) => notifyError(err.message),
      );
    },
    onItemFailed: (message) => notifyError(message),
  });

  const handleKernelEvent = useCallback(
    (event: BackendEvent) => {
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
          applyRemoteProgress({
            id: event.id,
            offset: event.offset,
            length: event.length,
          });
          break;
      }
    },
    [applyRemoteProgress, loadListing],
  );

  const backendStatus = useBackendStatus(handleKernelEvent);
  const { mode: themeMode, resolved: resolvedTheme, setMode: setThemeMode } = useTheme();

  const contextKeys = useMemo<ContextKeys>(
    () => ({
      "focus.pane": focusPane,
      "selection.count": selectedPaths.size,
      "selection.paths": Array.from(selectedPaths),
      "current-path": currentPath,
      "connection.online": backendStatus === "connected",
      "server.read-only": readOnly,
      "preview.is-image": selectedPath ? isImagePath(selectedPath) : false,
      "preview.path": selectedPath ?? "",
      "listing.show-dot-entries": showDotEntries,
    }),
    [focusPane, selectedPaths, currentPath, backendStatus, readOnly, selectedPath, showDotEntries],
  );

  const refreshListing = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    void loadListing(currentPathRef.current, { preserveSelection: true })
      .catch((err: Error) => notifyError(err.message))
      .finally(() => setRefreshing(false));
  }, [loadListing, refreshing]);

  const loadListingForNavigation = useCallback(
    (path: string) => loadListing(path),
    [loadListing],
  );

  const {
    navigateTo,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    trackCurrentPath,
  } = useExplorerNavigation(loadListingForNavigation, initialPath);

  useEffect(() => {
    trackCurrentPath(currentPath);
  }, [currentPath, trackCurrentPath]);

  const runBulkAction = useCallback(
    async (actionId: string, paths: string[]) => {
      try {
        await backend.runAction(actionId, paths);
      } catch {
        notifyError(t("error.actionFailed", { status: "failed" }));
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
    [backend, t, loadListing],
  );


  const toggleMultiSelect = useCallback((path: string) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      if (next.size === 0) {
        setSelectedPath(null);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    setSelectedPath(null);
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
      .filter((entry) => !entry.isDir && isImagePath(entry.path))
      .map((entry) => entry.path);
  }, []);

  const openSlideshow = useCallback((paths: string[], startPath: string | null) => {
    setSlideshowPaths(paths);
    setSlideshowStartPath(startPath);
    setSlideshowOpen(true);
  }, []);

  const visibleEntries = useMemo(
    () =>
      sortFileEntries(
        filterDotEntries(entries, showDotEntries),
        listingSortOrder,
      ),
    [entries, listingSortOrder, showDotEntries],
  );

  const listingEntries = useMemo<ListingEntry[]>(() => {
    return visibleEntries.map((entry) => ({
      key: entry.path,
      name: entry.name,
      path: entry.path,
      isDir: entry.is_dir,
      isSymlink: entry.is_symlink,
      size: entry.is_dir ? undefined : entry.size,
      modified: entry.modified,
      onSelect: (event, displayIndex) => {
        setFocusPane("file-list");
        const rows = listingEntriesRef.current;
        let nextSelectedPath: string | null = entry.path;

        if (event.shiftKey) {
          const anchor = selectionAnchorRef.current;
          const start = Math.min(anchor, displayIndex);
          const end = Math.max(anchor, displayIndex);
          setSelectedPaths(() => {
            const next = new Set<string>();
            for (let i = start; i <= end; i += 1) {
              const row = rows[i];
              if (row?.path) {
                next.add(row.path);
              }
            }
            return next;
          });
        } else if (event.metaKey || event.ctrlKey) {
          const next = new Set(selectedPathsRef.current);
          const removing = next.has(entry.path);
          if (removing) {
            next.delete(entry.path);
          } else {
            next.add(entry.path);
          }
          setSelectedPaths(next);
          if (next.size === 0) {
            nextSelectedPath = null;
          } else if (removing) {
            nextSelectedPath = next.values().next().value ?? null;
          }
          selectionAnchorRef.current = displayIndex;
        } else {
          setSelectedPaths(new Set([entry.path]));
          selectionAnchorRef.current = displayIndex;
        }

        setSelectedIndex(displayIndex);
        setSelectedPath(nextSelectedPath);
      },
      onActivate: () => {
        if (entry.is_dir) {
          navigateTo(entry.path);
        } else {
          setSelectedPath(entry.path);
        }
      },
      onContextMenu: (event) => void openContextMenuRef.current(event, entry.path),
      href:
        entry.is_dir || backend.mode === "s3"
          ? undefined
          : backend.downloadUrl(entry.path) as string,
    }));
  }, [visibleEntries, navigateTo, backend]);

  const listingColumnLabels = useMemo(
    (): ListingColumnLabels => ({
      name: t("listing.column.name"),
      size: t("listing.column.size"),
      modified: t("listing.column.modified"),
      locale: locale === "zh-CN" ? "zh-CN" : "en",
      modifiedTimeFormat,
      listingSortOrder,
    }),
    [t, locale, modifiedTimeFormat, listingSortOrder],
  );

  const displayOrderedEntries = useListingDisplayOrder(
    listingEntries,
    listingColumnLabels,
    columnSorting,
  );

  const activeListingEntries =
    listingViewMode === "table" ? displayOrderedEntries : listingEntries;

  useEffect(() => {
    listingEntriesRef.current = activeListingEntries;
    const path = selectedPathRef.current;
    if (!path) {
      return;
    }
    const nextIndex = activeListingEntries.findIndex((entry) => entry.path === path);
    if (nextIndex >= 0 && nextIndex !== selectedIndexRef.current) {
      setSelectedIndex(nextIndex);
      selectionAnchorRef.current = nextIndex;
    }
  }, [activeListingEntries]);

  const moveSelectedIndex = useCallback((updater: number | ((index: number) => number)) => {
    setSelectedIndex((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const entry = listingEntriesRef.current[next];
      if (entry?.path) {
        setSelectedPaths(new Set([entry.path]));
        setSelectedPath(entry.path);
      }
      return next;
    });
  }, []);

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
      setSelectedIndex: moveSelectedIndex,
      activateSelected,
      navigateTo,
      toggleMultiSelect,
      clearSelection,
      runBulkAction,
      getListingPathAt: (index: number) => {
        const row = listingEntriesRef.current[index];
        return row?.path ?? null;
      },
      openSettings: () => navigate("settings"),
      toggleShowDotEntries,
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
        setSelectedPaths(new Set([path]));
        setFocusPane("preview");
      },
      openSlideshow,
    }),
  );

  const openContextMenu = useCallback(
    async (event: React.MouseEvent, path: string) => {
      event.preventDefault();
      const actions = actionsForContext(
        actionSystem.registry.list(),
        "context-menu",
        contextKeys,
      ).map((action) => ({
        id: action.id,
        label: actionLabel(action.nameKey),
      }));
      if (actions.length === 0) {
        return;
      }
      setContextMenu({ x: event.clientX, y: event.clientY, path, actions });
    },
    [actionSystem.registry, actionLabel, contextKeys],
  );
  openContextMenuRef.current = openContextMenu;

  const blockSelectionClearRef = useRef(false);
  blockSelectionClearRef.current =
    actionSystem.paletteOpen ||
    actionSystem.confirmState != null ||
    contextMenu != null ||
    slideshowOpen ||
    uploadConflictItem != null;

  useEffect(() => {
    const shouldIgnoreTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return true;
      }
      if (target.closest("[data-listing-entry]")) {
        return true;
      }
      if (target.closest('[role="dialog"]')) {
        return true;
      }
      if (target.closest('[role="menu"]')) {
        return true;
      }
      if (
        target.closest(
          "button, a, input, textarea, select, [role='button'], [role='menuitem']",
        )
      ) {
        return true;
      }
      return false;
    };

    const onPointerDown = (event: MouseEvent) => {
      if (selectedPathsRef.current.size === 0) {
        return;
      }
      if (blockSelectionClearRef.current) {
        return;
      }
      if (shouldIgnoreTarget(event.target)) {
        return;
      }
      clearSelection();
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [clearSelection]);

  useEffect(() => {
    const selected = activeListingEntries[selectedIndex];
    if (selected?.path) {
      setSelectedPath(selected.path);
    }
  }, [selectedIndex, activeListingEntries]);

  const onUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || readOnly) {
        return;
      }
      enqueueUploads(files, currentPath);
    },
    [enqueueUploads, currentPath, readOnly],
  );

  const { dragging: fileDragActive } = useGlobalFileDrop({
    enabled: !readOnly,
    onDrop: onUpload,
  });

  return (
    <main className="flex h-dvh w-full flex-col gap-2 overflow-hidden p-2">
      <header className="shrink-0 space-y-4">
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
            <UploadButton disabled={readOnly} onSelect={onUpload} />
            <ShowDotEntriesToggle />
            <ListingViewToggle
              mode={listingViewMode}
              onChange={setListingViewMode}
            />
            <ThemeToggle mode={themeMode} onChange={setThemeMode} />
            <LanguageToggle iconOnly />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("settings.title")}
                  onClick={() => navigate("settings")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("settings.title")}</TooltipContent>
            </Tooltip>
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

      {fileDragActive ? (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          aria-hidden
        >
          <p className="rounded-lg border border-dashed border-primary bg-card px-6 py-4 text-base font-medium text-foreground shadow-lg">
            {t("upload.drop")}
          </p>
        </div>
      ) : null}

      <UploadPanel
        items={uploadItems}
        onClearFinished={clearFinishedUploads}
        onCancel={cancelUpload}
      />

      <UploadConflictDialog
        item={uploadConflictItem}
        onResolve={(resolution, applyToAll) => {
          if (uploadConflictItem) {
            resolveUploadConflict(uploadConflictItem.id, resolution, applyToAll);
          }
        }}
      />

      <section className="shrink-0 overflow-hidden rounded-xl bg-card">
        <ExplorerBreadcrumb
          currentPath={currentPath}
          rootAriaLabel={t("breadcrumb.root")}
          ariaLabel={t("breadcrumb.label")}
          addressBarLabel={t("breadcrumb.addressBar")}
          addressBarPlaceholder={t("breadcrumb.addressBarPlaceholder")}
          backLabel={t("breadcrumb.back")}
          forwardLabel={t("breadcrumb.forward")}
          refreshLabel={t("breadcrumb.refresh")}
          refreshing={refreshing}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={() => void goBack()}
          onForward={() => void goForward()}
          onRefresh={refreshListing}
          onNavigate={(path) => void navigateTo(path)}
        />
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
          <div
            className="h-full min-h-0 min-w-0 overflow-hidden"
            onMouseDown={() => setFocusPane("file-list")}
          >
            {listingViewMode === "grid" ? (
              <GridListing
                entries={listingEntries}
                selectedIndex={selectedIndex}
                focusedPath={selectedPath}
                multiSelectedPaths={selectedPaths}
                ariaLabel={t("listing.label")}
                iconTheme={resolvedTheme}
                className="h-full rounded-none border-0 shadow-none"
              />
            ) : (
              <VirtualListing
                entries={listingEntries}
                selectedIndex={selectedIndex}
                focusedPath={selectedPath}
                multiSelectedPaths={selectedPaths}
                ariaLabel={t("listing.label")}
                iconTheme={resolvedTheme}
                className="h-full rounded-none border-0 shadow-none"
                columnLabels={listingColumnLabels}
                sorting={columnSorting}
                onSortingChange={setColumnSorting}
              />
            )}
            {listCursor ? (
              <div className="border-t border-border p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void loadMoreEntries()}
                >
                  {loadingMore ? t("listing.loadingMore") : t("listing.loadMore")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-t border-border lg:border-t-0 lg:border-l">
            <PreviewPane
              path={selectedPath}
              onFocusPreview={() => setFocusPane("preview")}
              className="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent shadow-none"
            />
          </div>
        </div>
      </section>

      <section className="shrink-0">
        <StatusBar
          backendStatus={backendStatus}
          kernelVersion={kernelVersion}
          selectedCount={selectedPaths.size}
        />
      </section>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenu.actions}
          ariaLabel={t("contextMenu.label")}
          onSelect={(actionId) => {
            void actionSystem.invoke(actionId);
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
