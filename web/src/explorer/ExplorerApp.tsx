import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { SortingState } from "@tanstack/react-table";

import { Settings } from "lucide-react";

import ExplorerBreadcrumb from "../ExplorerBreadcrumb";
import ContextMenu, { type ContextMenuAction } from "../ContextMenu";
import StatusBar from "../StatusBar";
import LanguageToggle from "../LanguageToggle";
import ThemeToggle from "../ThemeToggle";
import ListingViewToggle from "../ListingViewToggle";
import PreviewPane from "../PreviewPane";
import PreviewSheet from "../PreviewSheet";
import VirtualListing, { type ListingEntry } from "../VirtualListing";
import GridListing from "../GridListing";
import SlideshowOverlay from "../SlideshowOverlay";
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
import AboutDialog from "../AboutDialog";
import KeyboardShortcutsDialog from "../KeyboardShortcutsDialog";
import MenuBar from "../actions/MenuBar";
import ActionToolbar from "../actions/ActionToolbar";
import { actionsForContext } from "../actions/dispatch";
import { type ContextKeys } from "../actions/contextKeys";
import { keybindingChordForContext } from "../actions/keybindings";
import { useActionSystem } from "../actions/useActionSystem";
import type { ActionDefinition } from "../actions/types";
import { downloadFiles, filterDownloadablePaths } from "../downloadPaths";
import { isImagePath } from "../imagePaths";
import { resolveViewerImagePaths } from "../slideshowPathOrder";
import {
  canShowInlinePreviewPanel,
  LG_BREAKPOINT_PX,
  PREVIEW_PANEL_WIDTH_PX,
} from "../previewLayout";
import {
  readListingViewMode,
  type ListingViewMode,
} from "../listingView";
import {
  restoreSelectionFromListing,
  shouldRefreshListing,
} from "../listingRefresh";
import { notifyApiError, notifyError, notifyWarning } from "../notifyError";
import UploadIndicator from "../UploadIndicator";
import UploadConflictDialog from "../UploadConflictDialog";
import { useMultipartSessions } from "../cloud/useMultipartSessions";
import type { MultipartSessionView } from "../cloud/useMultipartSessions";
import type { UnfinishedSessionView } from "../unfinishedUploadSessions";
import { useTusSessions } from "../local/useTusSessions";
import {
  activeMultipartUploadIds,
  activeTusUploadIds,
  useUploadQueue,
} from "../upload-queue";
import { useGlobalFileDrop } from "../useGlobalFileDrop";
import { useAppRoute } from "../routing/AppRouteProvider";
import { useModifiedTimeFormat } from "../settings/ModifiedTimeFormatProvider";
import { useListingSortOrder } from "../settings/ListingSortOrderProvider";
import { useShowDotEntries } from "../settings/ShowDotEntriesProvider";
import { useGridCardSize } from "../settings/GridCardSizeProvider";
import {
  computeGridColumnCount,
  GRID_GAP_PX,
} from "../settings/gridCardSize";
import ShowDotEntriesToggle from "../ShowDotEntriesToggle";
import { listingOverlayMessageKey } from "../listingEmpty";
import { filterDotEntries, isDotEntryName } from "../listingFilter";
import {
  collectSelectAllWarnings,
  isListingFullySelected,
  type SelectAllWarningReason,
} from "./listingSelectAll";
import {
  entryMatchesQuickFilter,
  filterEntriesByQuickFilter,
  firstQuickFilterMatchIndex,
  isPlainQuickFilterLetterKey,
  nextQuickFilterMatchIndex,
  normalizeQuickFilterQuery,
} from "../quickFilter";
import { sortFileEntries } from "../listingSort";
import type { ListingColumnLabels } from "../listing-types";
import { useListingDisplayOrder } from "../useListingDisplayOrder";
import DisconnectButton from "../cloud/DisconnectButton";
import { useCloudDisconnect } from "../cloud/CloudDisconnectContext";
import { loadSessionConfig } from "../cloud/credentials";
import ShareUrlButton from "../cloud/ShareUrlButton";
import { connectionConfigToShareInput } from "../cloud/shareUrl";
import { useExplorerNavigation } from "./useExplorerNavigation";
import { explorerPathFromPathname } from "./explorerUrl";
import { useExplorerFileOps } from "./useExplorerFileOps";

function multipartToUnfinishedSession(session: MultipartSessionView): UnfinishedSessionView {
  return {
    uploadId: session.uploadId,
    destPath: session.destPath,
    fileName: session.fileName,
    initiated: session.initiated,
    bytesUploaded: session.bytesUploaded,
    totalBytes: session.totalBytes,
    canResume: session.canResume,
    resuming: session.resuming,
    aborting: session.aborting,
    remoteOnly: !session.canResume,
    progressUnknown:
      session.bytesUploaded == null ||
      session.totalBytes == null ||
      session.totalBytes <= 0,
  };
}
import PasteDestinationDialog from "./PasteDestinationDialog";
import PasteConflictDialog from "./PasteConflictDialog";
import MarqueeOverlay from "./MarqueeOverlay";
import { pathsInIndexRange } from "./listingSelection";
import { useListingMarqueeSelect } from "./useListingMarqueeSelect";
import { basename } from "@/fileOperations/paths";

type ContextMenuState = {
  x: number;
  y: number;
  path: string | null;
  actions: ContextMenuAction[];
};

/** Shown on listing background only — hidden when no row is targeted. */
const CONTEXT_MENU_REQUIRES_ROW = new Set([
  "file.rename",
  "file.copy",
  "file.cut",
  "file.delete",
  "selection.copy-paths",
  "selection.download",
]);

function contextMenuActionLabel(
  action: ActionDefinition,
  menuContextKeys: ContextKeys,
  downloadablePaths: string[],
  t: (key: MessageKey, params?: Record<string, string>) => string,
  defaultLabel: string,
): string {
  if (action.id === "selection.copy-paths") {
    return t(
      menuContextKeys["selection.count"] === 1
        ? "actions.selection.copyPath.name"
        : "actions.selection.copyPaths.name",
    );
  }
  if (action.id === "selection.download") {
    if (downloadablePaths.length === 1) {
      return t("actions.selection.download.nameWithFile", {
        name: basename(downloadablePaths[0]!),
      });
    }
    return t("actions.selection.download.name");
  }
  return defaultLabel;
}

function isNativeTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true']") != null
  );
}

export default function ExplorerApp() {
  const backend = useExplorerBackend();
  const onCloudDisconnect = useCloudDisconnect();
  const cloudSessionConfig = onCloudDisconnect ? loadSessionConfig() : null;
  const { t, locale } = useTranslation();
  const { navigate } = useAppRoute();
  const { format: modifiedTimeFormat } = useModifiedTimeFormat();
  const { order: listingSortOrder } = useListingSortOrder();
  const { showDotEntries, toggleShowDotEntries } = useShowDotEntries();
  const { cardSize } = useGridCardSize();
  const initialPath = useMemo(
    () => explorerPathFromPathname(window.location.pathname),
    [],
  );
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [listCursor, setListCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listingLoaded, setListingLoaded] = useState(false);
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
  const [gridResizeActive, setGridResizeActive] = useState(false);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const [columnSorting, setColumnSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowPaths, setSlideshowPaths] = useState<string[]>([]);
  const [slideshowStartPath, setSlideshowStartPath] = useState<string | null>(null);
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [mainContentWidth, setMainContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : LG_BREAKPOINT_PX,
  );
  const [quickFilter, setQuickFilter] = useState("");
  const quickFilterInputRef = useRef<HTMLInputElement>(null);
  const listingViewportRef = useRef<HTMLDivElement | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const selectionAnchorRef = useRef(0);
  const currentPathRef = useRef(currentPath);
  const listingEntriesRef = useRef<ListingEntry[]>([]);
  const selectedIndexRef = useRef(selectedIndex);
  const selectedPathsRef = useRef(selectedPaths);
  const selectedPathRef = useRef(selectedPath);
  const openContextMenuRef = useRef<(event: React.MouseEvent, path: string | null) => void>(
    () => {},
  );
  currentPathRef.current = currentPath;
  selectedIndexRef.current = selectedIndex;
  selectedPathsRef.current = selectedPaths;
  selectedPathRef.current = selectedPath;

  const loadListing = useCallback(async (path: string, options?: { preserveSelection?: boolean; focusPath?: string }): Promise<boolean> => {
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
      const restored = options?.focusPath
        ? restoreSelectionFromListing(data, new Set([options.focusPath]), options.focusPath)
        : previousPaths != null
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
    } finally {
      setListingLoaded(true);
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
    enqueueResume,
    enqueueTusResume,
    applyRemoteProgress,
    cancelUpload,
    pauseUpload,
    resumeUpload,
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
    onMultipartSessionFinished: (uploadId) => {
      void multipartSessionsRef.current.onUploadSessionFinished(uploadId);
    },
    onTusSessionFinished: (uploadId) => {
      void tusSessionsRef.current.onUploadSessionFinished(uploadId);
    },
  });

  const multipartSessionsRef = useRef({
    onUploadSessionFinished: async (_uploadId: string) => {},
  });
  const tusSessionsRef = useRef({
    onUploadSessionFinished: async (_uploadId: string) => {},
  });
  const multipartSessions = useMultipartSessions({
    backend,
    readOnly,
    onResumeEnqueue: enqueueResume,
    onResumeMismatch: () => {
      notifyError(t("upload.multipart.fileMismatch"));
    },
    onError: (message) => notifyError(message),
  });
  multipartSessionsRef.current = multipartSessions;

  const tusSessions = useTusSessions({
    backend,
    readOnly,
    onResumeEnqueue: enqueueTusResume,
    onResumeMismatch: () => {
      notifyError(t("upload.multipart.fileMismatch"));
    },
    onError: (message) => notifyError(message),
  });
  tusSessionsRef.current = tusSessions;

  const visibleUnfinishedSessions = useMemo(() => {
    const activeMultipartIds = activeMultipartUploadIds(uploadItems);
    const activeTusIds = activeTusUploadIds(uploadItems);
    const rows: UnfinishedSessionView[] = [];
    if (multipartSessions.enabled) {
      rows.push(
        ...multipartSessions.sessions
          .filter((session) => !activeMultipartIds.has(session.uploadId))
          .map(multipartToUnfinishedSession),
      );
    }
    if (tusSessions.enabled) {
      rows.push(
        ...tusSessions.sessions.filter((session) => !activeTusIds.has(session.uploadId)),
      );
    }
    const sorted = rows.sort((a, b) => (b.initiated?.getTime() ?? 0) - (a.initiated?.getTime() ?? 0));
    return sorted;
  }, [uploadItems, multipartSessions.enabled, multipartSessions.sessions, tusSessions.enabled, tusSessions.sessions]);

  const resumeUnfinishedSession = useCallback(
    (uploadId: string) => {
      if (multipartSessions.sessions.some((session) => session.uploadId === uploadId)) {
        void multipartSessions.resumeSession(uploadId);
        return;
      }
      void tusSessions.resumeSession(uploadId);
    },
    [multipartSessions, tusSessions],
  );

  const abortUnfinishedSession = useCallback(
    (uploadId: string) => {
      if (multipartSessions.sessions.some((session) => session.uploadId === uploadId)) {
        void multipartSessions.abortSession(uploadId);
        return;
      }
      void tusSessions.abortSession(uploadId);
    },
    [multipartSessions, tusSessions],
  );

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
    (path: string, options?: { preserveSelection?: boolean; focusPath?: string }) =>
      loadListing(path, options),
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

  const openSymlinkTarget = useCallback(
    async (resolvedPath: string) => {
      try {
        const targetStat = await backend.stat(resolvedPath);
        if (targetStat.is_dir) {
          await navigateTo(resolvedPath);
          return;
        }
        await navigateTo(resolvedPath, { focusPath: resolvedPath });
      } catch (err) {
        if (err instanceof Response) {
          await notifyApiError(err, t);
          return;
        }
        notifyError(err instanceof Error ? err.message : String(err));
      }
    },
    [backend, navigateTo, t],
  );

  const getOperationTargets = useCallback(() => {
    const selected = Array.from(selectedPathsRef.current);
    if (selected.length > 0) {
      return selected;
    }
    const path =
      selectedPathRef.current ??
      listingEntriesRef.current[selectedIndexRef.current]?.path;
    return path ? [path] : [];
  }, []);

  const getPrimaryPath = useCallback(() => selectedPathRef.current, []);

  const fileOps = useExplorerFileOps({
    backend,
    readOnly,
    currentPath,
    entries,
    getTargets: getOperationTargets,
    getPrimaryPath,
    loadListing,
    t,
  });

  const runBulkAction = useCallback(
    async (actionId: string, paths: string[]) => {
      if (actionId === "copy-path") {
        try {
          await navigator.clipboard.writeText(paths.join("\n"));
        } catch {
          notifyError(t("error.actionFailed", { status: "failed" }));
        }
        return;
      }
      try {
        await backend.runAction({ actionId, paths });
      } catch {
        notifyError(t("error.actionFailed", { status: "failed" }));
        return;
      }
      if (actionId === "file.delete") {
        fileOps.clearClipboard();
        setSelectedPaths(new Set());
        setSelectedPath(null);
        await loadListing(currentPathRef.current);
      }
    },
    [backend, fileOps, t, loadListing],
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

  const getImagePaths = useCallback(
    () =>
      resolveViewerImagePaths(
        Array.from(selectedPathsRef.current),
        listingEntriesRef.current,
      ),
    [],
  );

  const openSlideshow = useCallback((paths: string[], startPath: string | null) => {
    setSlideshowPaths(paths);
    setSlideshowStartPath(startPath);
    setSlideshowOpen(true);
  }, []);

  const handleSlideshowCurrentPathChange = useCallback((path: string) => {
    const index = listingEntriesRef.current.findIndex((entry) => entry.path === path);
    if (index >= 0) {
      setSelectedIndex(index);
    }
    setSelectedPath(path);
  }, []);

  const quickFilterActive = normalizeQuickFilterQuery(quickFilter).length > 0;

  const visibleEntries = useMemo(() => {
    const sorted = sortFileEntries(entries, listingSortOrder);
    if (quickFilterActive) {
      return sorted;
    }
    return filterDotEntries(sorted, showDotEntries);
  }, [entries, listingSortOrder, quickFilterActive, showDotEntries]);

  const quickMatchedEntries = useMemo(
    () => filterEntriesByQuickFilter(visibleEntries, quickFilter),
    [visibleEntries, quickFilter],
  );

  const quickFilteredEntries = quickMatchedEntries;

  useEffect(() => {
    const onViewportResize = () => setViewportWidth(window.innerWidth);
    onViewportResize();
    window.addEventListener("resize", onViewportResize);
    return () => window.removeEventListener("resize", onViewportResize);
  }, []);

  useEffect(() => {
    const node = mainContentRef.current;
    if (!node) {
      return;
    }
    const measure = () => setMainContentWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [listingLoaded, quickFilteredEntries.length, listingViewMode]);

  const inlinePreviewAvailable = useMemo(
    () => canShowInlinePreviewPanel(mainContentWidth, viewportWidth),
    [mainContentWidth, viewportWidth],
  );

  const selectedFileCount = useMemo(
    () => filterDownloadablePaths(Array.from(selectedPaths), entries).length,
    [selectedPaths, entries],
  );

  const viewerImageCount = useMemo(() => {
    const listingSource = quickFilteredEntries.map((entry) => ({
      path: entry.path,
      isDir: entry.is_dir,
    }));
    return resolveViewerImagePaths(Array.from(selectedPaths), listingSource).length;
  }, [selectedPaths, quickFilteredEntries]);

  const contextKeys = useMemo<ContextKeys>(
    () => ({
      "focus.pane": focusPane,
      "selection.count": selectedPaths.size,
      "selection.file-count": selectedFileCount,
      "selection.paths": Array.from(selectedPaths),
      "current-path": currentPath,
      "connection.online": backendStatus === "connected",
      "server.read-only": readOnly,
      "clipboard.count": fileOps.clipboard?.paths.length ?? 0,
      "preview.is-image": selectedPath ? isImagePath(selectedPath) : false,
      "preview.path": selectedPath ?? "",
      "viewer.image-count": viewerImageCount,
      "listing.show-dot-entries": showDotEntries,
      "listing.loaded": listingLoaded,
      "listing.visible-count": quickFilteredEntries.length,
      "listing.view": listingViewMode,
      "slideshow.open": slideshowOpen,
      "preview.inline-available": inlinePreviewAvailable,
      "preview.sheet-open": previewSheetOpen,
    }),
    [
      focusPane,
      selectedPaths,
      selectedFileCount,
      currentPath,
      backendStatus,
      readOnly,
      selectedPath,
      showDotEntries,
      viewerImageCount,
      fileOps.clipboard,
      listingLoaded,
      quickFilteredEntries.length,
      listingViewMode,
      slideshowOpen,
      inlinePreviewAvailable,
      previewSheetOpen,
    ],
  );

  const gridColumnCount = useMemo(
    () => computeGridColumnCount(gridViewportWidth, cardSize.width, GRID_GAP_PX),
    [gridViewportWidth, cardSize.width],
  );
  const gridColumnCountRef = useRef(gridColumnCount);
  gridColumnCountRef.current = gridColumnCount;
  const listingViewModeRef = useRef(listingViewMode);
  listingViewModeRef.current = listingViewMode;

  useEffect(() => {
    if (listingViewMode !== "grid") {
      return;
    }
    const node = listingViewportRef.current;
    if (!node) {
      return;
    }
    const viewportPaddingPx = 12;
    const measure = () => {
      setGridViewportWidth(Math.max(0, node.clientWidth - viewportPaddingPx * 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [listingViewMode, listingLoaded, quickFilteredEntries.length]);

  const listingOverlayKey = listingOverlayMessageKey({
    listingLoaded,
    quickFilterActive,
    visibleEntryCount: visibleEntries.length,
    filteredEntryCount: quickFilteredEntries.length,
  });

  useEffect(() => {
    setQuickFilter("");
  }, [currentPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (slideshowOpen) {
        return;
      }
      const isMac =
        typeof navigator !== "undefined" &&
        navigator.platform.toLowerCase().includes("mac");
      const mod = (isMac && event.metaKey) || (!isMac && event.ctrlKey);
      if (!mod || event.key.toLowerCase() !== "f") {
        return;
      }
      const target = event.target;
      if (isNativeTypingTarget(target)) {
        return;
      }
      event.preventDefault();
      const input = quickFilterInputRef.current;
      input?.focus();
      input?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slideshowOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        slideshowOpen ||
        previewSheetOpen ||
        focusPane !== "file-list" ||
        !isPlainQuickFilterLetterKey(event) ||
        isNativeTypingTarget(event.target)
      ) {
        return;
      }
      const target = event.target;
      const targetElement = target instanceof HTMLElement ? target : null;
      const targetInListingArea =
        !targetElement ||
        targetElement === document.body ||
        mainContentRef.current?.contains(targetElement);
      if (!targetInListingArea) {
        return;
      }

      event.preventDefault();
      quickFilterInputRef.current?.focus();
      setQuickFilter((current) => `${current}${event.key}`);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusPane, previewSheetOpen, slideshowOpen]);

  const listingEntries = useMemo((): Array<ListingEntry> => {
    return quickFilteredEntries.map((entry) => {
      const listingEntry: ListingEntry = {
        key: entry.path,
        name: entry.name,
        path: entry.path,
        isDir: entry.is_dir,
        isSymlink: entry.is_symlink,
        quickFilterMatched: quickFilterActive
          ? entryMatchesQuickFilter(entry.name, quickFilter)
          : true,
        size: entry.is_dir ? undefined : entry.size,
        modified: entry.modified,
        onSelect: (event, displayIndex) => {
          setFocusPane("file-list");
          const rows = listingEntriesRef.current;
          let nextSelectedPath: string | null = entry.path;

          if (event.shiftKey) {
            setSelectedPaths(
              pathsInIndexRange(rows, selectionAnchorRef.current, displayIndex),
            );
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
        onContextMenu: (event) => {
          event.stopPropagation();
          void openContextMenuRef.current(event, entry.path);
        },
        href:
          entry.is_dir || backend.mode === "s3"
            ? undefined
            : (backend.downloadUrl(entry.path) as string),
      };
      return listingEntry;
    });
  }, [
    quickFilteredEntries,
    quickFilterActive,
    quickFilter,
    navigateTo,
    backend,
  ]);

  const listingColumnLabels = useMemo(
    (): ListingColumnLabels => ({
      name: t("listing.column.name"),
      size: t("listing.column.size"),
      modified: t("listing.column.modified"),
      locale,
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

  const applyMarqueeSelection = useCallback((paths: Set<string>, primaryPath: string | null) => {
    setSelectedPaths(paths);
    if (paths.size === 0) {
      setSelectedPath(null);
      return;
    }
    const focusPath =
      primaryPath && paths.has(primaryPath)
        ? primaryPath
        : ([...paths].find((path) =>
            listingEntriesRef.current.some((entry) => entry.path === path),
          ) ?? null);
    if (!focusPath) {
      setSelectedPath(null);
      return;
    }
    const focusIndex = listingEntriesRef.current.findIndex(
      (entry) => entry.path === focusPath,
    );
    setSelectedPath(focusPath);
    if (focusIndex >= 0) {
      setSelectedIndex(focusIndex);
      selectionAnchorRef.current = focusIndex;
    }
  }, []);

  const marqueeSelect = useListingMarqueeSelect({
    selectedPaths,
    enabled:
      listingLoaded &&
      !listingOverlayKey &&
      activeListingEntries.length > 0 &&
      !gridResizeActive,
    scrollElementRef: listingViewportRef,
    onSelectionChange: applyMarqueeSelection,
  });

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

  useEffect(() => {
    if (!quickFilterActive) {
      return;
    }
    const matchIndex = firstQuickFilterMatchIndex(activeListingEntries);
    if (matchIndex >= 0) {
      const match = activeListingEntries[matchIndex]!;
      setSelectedIndex(matchIndex);
      setSelectedPath(match.path);
      setSelectedPaths(new Set([match.path]));
      selectionAnchorRef.current = matchIndex;
      return;
    }

    setSelectedPaths((prev) => {
      const displayPaths = new Set(activeListingEntries.map((entry) => entry.path));
      const next = new Set([...prev].filter((path) => displayPaths.has(path)));
      return next.size === prev.size ? prev : next;
    });
  }, [activeListingEntries, quickFilter, quickFilterActive]);

  const selectListingIndex = useCallback(
    (index: number, options?: { extendRange?: boolean }) => {
      const rows = listingEntriesRef.current;
      const entry = rows[index];
      if (!entry) {
        return;
      }
      setSelectedIndex(index);
      if (options?.extendRange) {
        setSelectedPaths(pathsInIndexRange(rows, selectionAnchorRef.current, index));
        setSelectedPath(entry.path);
        return;
      }
      setSelectedPaths(new Set([entry.path]));
      setSelectedPath(entry.path);
      selectionAnchorRef.current = index;
    },
    [],
  );

  const moveSelectedIndex = useCallback(
    (
      updater: number | ((index: number) => number),
      options?: { extendRange?: boolean },
    ) => {
      const previous = selectedIndexRef.current;
      const next = typeof updater === "function" ? updater(previous) : updater;
      selectListingIndex(next, options);
    },
    [selectListingIndex],
  );

  const activateSelected = useCallback(() => {
    const selected = listingEntriesRef.current[selectedIndexRef.current];
    if (selected) {
      selected.onActivate();
    }
  }, []);

  const activateQuickFilterSelection = useCallback(() => {
    const selected = listingEntriesRef.current[selectedIndexRef.current];
    if (!selected || (quickFilterActive && selected.quickFilterMatched === false)) {
      return;
    }
    selected.onActivate();
  }, [quickFilterActive]);

  const moveQuickFilterSelection = useCallback(
    (direction: "up" | "down") => {
      const nextIndex = nextQuickFilterMatchIndex(
        listingEntriesRef.current,
        selectedIndexRef.current,
        direction,
      );
      if (nextIndex < 0) {
        return;
      }
      selectListingIndex(nextIndex);
    },
    [selectListingIndex],
  );

  const handleQuickFilterKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        activateQuickFilterSelection();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveQuickFilterSelection(event.key === "ArrowDown" ? "down" : "up");
      }
    },
    [activateQuickFilterSelection, moveQuickFilterSelection],
  );

  const selectAllVisible = useCallback(() => {
    const rows = listingEntriesRef.current;
    const visiblePaths = rows.map((entry) => entry.path);
    if (visiblePaths.length === 0) {
      return;
    }
    if (isListingFullySelected(visiblePaths, selectedPathsRef.current)) {
      return;
    }
    const warningKeys: Record<SelectAllWarningReason, MessageKey> = {
      "hidden-dot-entries": "actions.selection.selectAll.warning.hiddenDotEntries",
      "quick-filter-active": "actions.selection.selectAll.warning.quickFilter",
      "more-to-load": "actions.selection.selectAll.warning.moreToLoad",
    };
    for (const reason of collectSelectAllWarnings({
      quickFilterActive,
      quickFilteredCount: quickMatchedEntries.length,
      visibleEntryCount: visibleEntries.length,
      hasHiddenDotEntries:
        !showDotEntries && entries.some((entry) => isDotEntryName(entry.name)),
      hasMoreToLoad: listCursor != null,
    })) {
      notifyWarning(t(warningKeys[reason]));
    }
    const lastPath = visiblePaths[visiblePaths.length - 1] ?? null;
    const lastIndex = rows.length - 1;
    setSelectedPaths(new Set(visiblePaths));
    setSelectedPath(lastPath);
    setSelectedIndex(lastIndex);
    selectionAnchorRef.current = lastIndex;
  }, [
    entries,
    listCursor,
    quickFilterActive,
    quickMatchedEntries.length,
    showDotEntries,
    t,
    visibleEntries.length,
  ]);

  const getDownloadablePaths = useCallback(() => {
    return filterDownloadablePaths(getOperationTargets(), entries);
  }, [getOperationTargets, entries]);

  const downloadPathsHandler = useCallback(
    async (paths: string[]) => {
      await downloadFiles(backend, paths);
    },
    [backend],
  );

  const confirmMessageRef = useRef<
    (messageKey: string, params?: Record<string, string>) => Promise<boolean>
  >(async () => false);

  const actionSystem = useActionSystem(
    contextKeys,
    {
      getListingLength: () => listingEntriesRef.current.length,
      getListingViewMode: () => listingViewModeRef.current,
      getGridColumnCount: () => gridColumnCountRef.current,
      getSelectedIndex: () => selectedIndexRef.current,
      getSelectedPaths: () => Array.from(selectedPathsRef.current),
      getCurrentPath: () => currentPathRef.current,
      setSelectedIndex: moveSelectedIndex,
      activateSelected,
      navigateTo,
      toggleMultiSelect,
      clearSelection,
      runBulkAction,
      getDownloadablePaths,
      downloadPaths: downloadPathsHandler,
      confirmAction: (messageKey, params) =>
        confirmMessageRef.current(messageKey, params),
      getListingPathAt: (index: number) => {
        const row = listingEntriesRef.current[index];
        return row?.path ?? null;
      },
      getOperationTargets,
      getPrimaryPath,
      copySelection: fileOps.copySelection,
      cutSelection: fileOps.cutSelection,
      pasteFromClipboard: fileOps.pasteFromClipboard,
      createNewFolder: fileOps.createNewFolder,
      startRename: fileOps.startRename,
      selectAllVisible,
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
    () => ({
      openPreviewSheet: () => setPreviewSheetOpen(true),
    }),
    () => ({
      openAbout: () => setAboutOpen(true),
      openKeyboardShortcuts: () => setKeyboardShortcutsOpen(true),
    }),
  );
  confirmMessageRef.current = actionSystem.confirmMessage;

  const openContextMenu = useCallback(
    async (event: React.MouseEvent, path: string | null) => {
      event.preventDefault();
      setFocusPane("file-list");

      let menuContextKeys = contextKeys;
      const listingRows = listingEntriesRef.current;
      const imageCountForSelection = (paths: string[]) =>
        resolveViewerImagePaths(paths, listingRows).length;
      if (path == null) {
        setSelectedPaths(new Set());
        setSelectedPath(null);
        menuContextKeys = {
          ...contextKeys,
          "selection.count": 0,
          "selection.paths": [],
          "preview.path": "",
          "preview.is-image": false,
          "viewer.image-count": 0,
        };
      } else if (!selectedPathsRef.current.has(path)) {
        const rows = listingEntriesRef.current;
        const displayIndex = rows.findIndex((row) => row.path === path);
        setSelectedPaths(new Set([path]));
        setSelectedPath(path);
        if (displayIndex >= 0) {
          setSelectedIndex(displayIndex);
          selectionAnchorRef.current = displayIndex;
        }
        menuContextKeys = {
          ...contextKeys,
          "selection.count": 1,
          "selection.paths": [path],
          "preview.path": path,
          "preview.is-image": isImagePath(path),
          "viewer.image-count": imageCountForSelection([path]),
        };
      } else {
        menuContextKeys = {
          ...contextKeys,
          "preview.path": path,
          "preview.is-image": isImagePath(path),
          "viewer.image-count": imageCountForSelection(
            Array.from(selectedPathsRef.current),
          ),
        };
      }

      const downloadablePaths = filterDownloadablePaths(
        menuContextKeys["selection.paths"],
        entries,
      );
      menuContextKeys = {
        ...menuContextKeys,
        "selection.file-count": downloadablePaths.length,
      };

      let actions = actionsForContext(
        actionSystem.registry.list(),
        "context-menu",
        menuContextKeys,
      );
      if (path == null) {
        actions = actions.filter((action) => !CONTEXT_MENU_REQUIRES_ROW.has(action.id));
      }
      const menuActions: ContextMenuAction[] = actions.map((action) => {
        const chord = keybindingChordForContext(
          action.id,
          actionSystem.keybindings,
          menuContextKeys,
          {
            defaultKeybinding: action.defaultKeybinding,
            userBindings: actionSystem.userKeybindings,
          },
        );
        return {
          id: action.id,
          label: contextMenuActionLabel(
            action,
            menuContextKeys,
            downloadablePaths,
            (key, params) => t(key, params),
            actionLabel(action.nameKey),
          ),
          chord,
          variant: action.destructive ? "destructive" : "default",
        };
      });
      if (menuActions.length === 0) {
        return;
      }
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        path,
        actions: menuActions,
      });
    },
    [
      actionSystem.keybindings,
      actionSystem.registry,
      actionSystem.userKeybindings,
      actionLabel,
      contextKeys,
      entries,
    ],
  );
  openContextMenuRef.current = openContextMenu;

  const blockSelectionClearRef = useRef(false);
  blockSelectionClearRef.current =
    actionSystem.paletteOpen ||
    actionSystem.confirmState != null ||
    contextMenu != null ||
    slideshowOpen ||
    previewSheetOpen ||
    uploadConflictItem != null ||
    fileOps.pasteDestOpen ||
    fileOps.pasteConflict != null ||
    fileOps.inlineEditPath != null ||
    marqueeSelect.isActive;

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
    (dropped: { file: File; sourceHandle: FileSystemFileHandle | null }[]) => {
      if (dropped.length === 0 || readOnly) {
        return;
      }
      enqueueUploads(dropped, currentPath);
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
            <UploadIndicator
              items={uploadItems}
              onSelect={onUpload}
              readOnly={readOnly}
              onClearFinished={clearFinishedUploads}
              onCancel={cancelUpload}
              onPause={pauseUpload}
              onResume={resumeUpload}
              unfinishedSessions={
                multipartSessions.enabled || tusSessions.enabled
                  ? {
                      sessions: visibleUnfinishedSessions,
                      readOnly: readOnly || multipartSessions.readOnly,
                      onResume: resumeUnfinishedSession,
                      onAbort: abortUnfinishedSession,
                    }
                  : undefined
              }
            />
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
            {onCloudDisconnect ? (
              <>
                {cloudSessionConfig ? (
                  <ShareUrlButton
                    input={connectionConfigToShareInput(cloudSessionConfig)}
                    explorerPath={currentPath}
                  />
                ) : null}
                <DisconnectButton onClick={onCloudDisconnect} />
              </>
            ) : null}
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

      <UploadConflictDialog
        backend={backend}
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
          quickFilterLabel={t("quickFilter.label")}
          quickFilterPlaceholder={t("quickFilter.placeholder")}
          quickFilterClearLabel={t("quickFilter.clear")}
          quickFilterHelpText={t("quickFilter.help")}
          quickFilterRegexErrorLabel={t("quickFilter.regexError")}
          quickFilterValue={quickFilter}
          onQuickFilterChange={setQuickFilter}
          onQuickFilterKeyDown={handleQuickFilterKeyDown}
          quickFilterInputRef={quickFilterInputRef}
        />
      </section>

      <section
        ref={mainContentRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card"
      >
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            onMouseDown={() => setFocusPane("file-list")}
            onContextMenu={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest("[data-listing-entry]")
              ) {
                return;
              }
              void openContextMenuRef.current(event, null);
            }}
          >
            {listingOverlayKey ? (
              <p
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-sm text-muted-foreground"
                role="status"
              >
                {t(listingOverlayKey)}
              </p>
            ) : null}
            <MarqueeOverlay rect={marqueeSelect.marqueeRect} />
            {listingViewMode === "grid" ? (
              <GridListing
                entries={listingEntries}
                selectedIndex={selectedIndex}
                focusedPath={selectedPath}
                multiSelectedPaths={selectedPaths}
                cutPaths={fileOps.cutPaths}
                inlineEditPath={fileOps.inlineEditPath}
                listingViewportRef={listingViewportRef}
                onViewportPointerDown={marqueeSelect.onViewportPointerDown}
                marqueeActive={marqueeSelect.isActive}
                onResizeActiveChange={setGridResizeActive}
                onInlineCommit={(path, name) => {
                  void fileOps.commitRename(path, name).then((ok) => {
                    if (ok) {
                      fileOps.setInlineEditPath(null);
                    }
                  });
                }}
                onInlineCancel={(path, initialName) => {
                  void fileOps.cancelInlineEdit(path, initialName);
                }}
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
                cutPaths={fileOps.cutPaths}
                inlineEditPath={fileOps.inlineEditPath}
                listingViewportRef={listingViewportRef}
                onViewportPointerDown={marqueeSelect.onViewportPointerDown}
                marqueeActive={marqueeSelect.isActive}
                onInlineCommit={(path, name) => {
                  void fileOps.commitRename(path, name).then((ok) => {
                    if (ok) {
                      fileOps.setInlineEditPath(null);
                    }
                  });
                }}
                onInlineCancel={(path, initialName) => {
                  void fileOps.cancelInlineEdit(path, initialName);
                }}
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
          {inlinePreviewAvailable ? (
            <div
              className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-t border-border lg:border-t-0 lg:border-l"
              style={{ width: PREVIEW_PANEL_WIDTH_PX }}
            >
              <PreviewPane
                path={selectedPath}
                onFocusPreview={() => setFocusPane("preview")}
                onSymlinkTargetClick={(resolvedPath) => void openSymlinkTarget(resolvedPath)}
                className="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent shadow-none"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="shrink-0">
        <StatusBar
          backendStatus={backendStatus}
          kernelVersion={kernelVersion}
          selectedCount={selectedPaths.size}
          cutStatusText={
            fileOps.cutPaths.length > 0
              ? fileOps.cutPaths.length === 1
                ? t("clipboard.cutOne", { name: basename(fileOps.cutPaths[0] ?? "") })
                : t("clipboard.cutMany", { count: String(fileOps.cutPaths.length) })
              : null
          }
          onVersionClick={() => setAboutOpen(true)}
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

      <AboutDialog
        open={aboutOpen}
        kernelVersion={kernelVersion}
        onOpenChange={setAboutOpen}
      />

      <KeyboardShortcutsDialog
        open={keyboardShortcutsOpen}
        actions={actionSystem.registry.list()}
        keybindings={actionSystem.keybindings}
        labelForKey={actionLabel}
        onOpenChange={setKeyboardShortcutsOpen}
      />

      {fileOps.pasteDestContext ? (
        <PasteDestinationDialog
          open={fileOps.pasteDestOpen}
          folderName={fileOps.pasteDestContext.folderName}
          currentFolderName={fileOps.pasteDestContext.currentFolderName}
          onChoose={fileOps.onPasteDestinationChoose}
          onCancel={fileOps.onPasteDestinationCancel}
        />
      ) : null}

      {fileOps.pasteConflict ? (
        <PasteConflictDialog
          sourceName={fileOps.pasteConflict.sourceName}
          destName={fileOps.pasteConflict.destName}
          typeMismatch={fileOps.pasteConflict.typeMismatch}
          onResolve={fileOps.onPasteConflictResolve}
        />
      ) : null}

      <ActionConfirmDialog
        action={
          fileOps.renameReplace
            ? {
                id: "file.rename.replace",
                nameKey: "actions.file.rename.name",
                categoryKey: "actions.file.category",
                handler: async () => {},
              }
            : actionSystem.confirmState?.action ?? null
        }
        title={t("actions.confirm.title")}
        cancelLabel={t("actions.confirm.cancel")}
        confirmLabel={t("actions.confirm.confirm")}
        message={
          fileOps.renameReplace
            ? t("file.rename.replace.confirm", {
                name: fileOps.renameReplace.newName,
              })
            : actionSystem.confirmState?.messageKey
              ? t(
                  actionSystem.confirmState.messageKey as MessageKey,
                  actionSystem.confirmState.messageParams,
                )
              : actionSystem.confirmState?.action.confirmMessageKey
                ? t(actionSystem.confirmState.action.confirmMessageKey as MessageKey)
                : actionSystem.confirmState
                  ? t("actions.confirm.defaultMessage", {
                      name: actionLabel(actionSystem.confirmState.action.nameKey),
                    })
                  : ""
        }
        onCancel={() => {
          if (fileOps.renameReplace) {
            fileOps.setRenameReplace(null);
            return;
          }
          actionSystem.dismissConfirm(false);
        }}
        onConfirm={() => {
          if (fileOps.renameReplace) {
            void fileOps.confirmRenameReplace();
            return;
          }
          actionSystem.dismissConfirm(true);
        }}
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

      <SlideshowOverlay
        open={slideshowOpen}
        paths={slideshowPaths}
        startPath={slideshowStartPath}
        onOpenChange={setSlideshowOpen}
        onCurrentPathChange={handleSlideshowCurrentPathChange}
      />

      <PreviewSheet
        open={previewSheetOpen}
        onOpenChange={setPreviewSheetOpen}
        path={selectedPath}
        onSymlinkTargetClick={(resolvedPath) => void openSymlinkTarget(resolvedPath)}
      />

      <Toaster richColors closeButton position="bottom-right" />
    </main>
  );
}
