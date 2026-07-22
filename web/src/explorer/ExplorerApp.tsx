import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";

import { Settings, Loader2, ListChecks } from "lucide-react";

import ExplorerBreadcrumb from "../ExplorerBreadcrumb";
import ExplorerCompactToolbar from "../ExplorerCompactToolbar";
import ContextMenu, { type ContextMenuAction } from "../ContextMenu";
import StatusBar from "../StatusBar";
import LanguageToggle from "../LanguageToggle";
import ThemeToggle from "../ThemeToggle";
import UiModeToggle from "../UiModeToggle";
import ListingViewToggle from "../ListingViewToggle";
import InfoDialog from "../InfoDialog";
import VirtualListing, { type ListingEntry } from "../VirtualListing";
import GridListing from "../GridListing";
import SlideshowOverlay from "../SlideshowOverlay";
import { useExplorerBackend, type FileEntry } from "../backend";
import { useTranslation, type MessageKey } from "../i18n";
import { useBackendStatus, type BackendEvent } from "../useBackendStatus";
import { useTheme } from "../useTheme";
import { useUiMode } from "../useUiMode";
import { useCompactTouchChrome } from "../useCompactTouchChrome";
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
import SelectModeActionToolbar from "../actions/SelectModeActionToolbar";
import {
  buildContextMenuContextKeys,
  resolveContextMenuActions,
} from "../actions/contextMenuActions";
import { type ContextKeys } from "../actions/contextKeys";
import { useActionSystem } from "../actions/useActionSystem";
import { downloadFiles, filterDownloadablePaths } from "../downloadPaths";
import { isImagePath } from "../imagePaths";
import { resolveViewerPreviewPaths } from "../slideshowPathOrder";
import {
  nextListingViewMode,
  type ListingViewMode,
} from "../listingView";
import {
  applyGlobalListingSettings,
  clearFolderGridCardSizeOverride,
  readEffectiveFolderViewSettings,
  writeFolderViewOverride,
} from "../settings/folderViewSettings";
import {
  restoreSelectionFromListing,
  selectionSnapshotForRefresh,
  shouldRefreshListing,
} from "../listingRefresh";
import { applySelectionModeShell } from "./selectionModeShell";
import { notifyApiError, notifyError, notifyWarning } from "../notifyError";
import {
  countSelectedFileFolders,
  formatCutStatusLabel,
  formatSelectionStatusLabel,
} from "../selectionStatusText";
import UploadIndicator, { type UploadIndicatorHandle } from "../UploadIndicator";
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
import { useOperationPending } from "../useOperationPending";
import { useAppRoute } from "../routing/AppRouteProvider";
import { useModifiedTimeFormat } from "../settings/ModifiedTimeFormatProvider";
import { useListingSortOrder } from "../settings/ListingSortOrderProvider";
import { useShowDotEntries } from "../settings/ShowDotEntriesProvider";
import { useGridCardSize } from "../settings/GridCardSizeProvider";
import {
  computeGridColumnCount,
  GRID_GAP_PX,
  type GridCardSize,
} from "../settings/gridCardSize";
import ShowDotEntriesToggle from "../ShowDotEntriesToggle";
import { listingPaneOverlayKey } from "../listingEmpty";
import { ASYNC_VISUAL_DELAY_MS } from "../asyncVisualDelay";
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
  isQuickFilterTypeaheadKey,
  nextQuickFilterMatchIndex,
  normalizeQuickFilterQuery,
} from "../quickFilter";
import { sortFileEntries } from "../listingSort";
import type { ListingColumnLabels } from "../listing-types";
import { useListingDisplayOrder } from "../useListingDisplayOrder";
import DisconnectButton from "../cloud/DisconnectButton";
import { useCloudDisconnect } from "../cloud/CloudDisconnectContext";
import { CloudAuthExpiredBanner, useCloudAuth } from "../cloud/CloudAuthContext";
import { loadSessionConfig } from "../cloud/credentials";
import ShareUrlButton from "../cloud/ShareUrlButton";
import { connectionConfigToShareInput, buildShareUrl } from "../cloud/shareUrl";
import { readShareUrlIncludeCredentials } from "../cloud/shareUrlSettings";
import { appBasePath } from "../routing/appBase";
import { toast } from "sonner";
import { captureListingNavigationSnapshot } from "./listingNavigationSnapshot";
import type { ListingNavigationSnapshot } from "./listingNavigationSnapshot";
import { useExplorerNavigation } from "./useExplorerNavigation";
import { explorerPathFromPathname } from "./explorerUrl";
import { useExplorerFileOps } from "./useExplorerFileOps";
import ExplorerDndProvider from "./ExplorerDndProvider";
import { resolveGridSectionFolderCount } from "./gridListingLayout";

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
import type { ListingMarqueeLayoutResolver } from "./listingMarqueeSelect";
import { pathsInIndexRange } from "./listingSelection";
import { useListingMarqueeSelect } from "./useListingMarqueeSelect";
import {
  shouldClearTouchSelectionOnBrowse,
  shouldClearTouchSelectionOutsideSelectionMode,
  shouldTouchTapActivate,
  keyboardFocusVisibleAfterListingMove,
  resolveListingFocusedPath,
  resolveLongPressGestureHighlightPath,
} from "./listingTouchSelect";
import {
  armedRangeSelection,
  longPressGestureAction,
  resolveArmedRangeMode,
  type ArmedRangeMode,
} from "./listingTouchSelectGestures";
import { swipeRangeFromAnchor } from "./listingSwipeRangeSelect";
import type { ContextMenuPointerEvent } from "./listingLongPressContextMenu";
import { useListingLongPressRangeSelect } from "./useListingLongPressRangeSelect";
import { basename } from "@/fileOperations/paths";
import { copyTextToClipboard } from "@/copyTextToClipboard";

type ContextMenuState = {
  x: number;
  y: number;
  path: string | null;
  actions: ContextMenuAction[];
};

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
  const cloudAuth = useCloudAuth();
  const cloudSessionConfig = onCloudDisconnect ? loadSessionConfig() : null;
  const { t, locale, setLocale } = useTranslation();
  const { navigate } = useAppRoute();
  const { format: modifiedTimeFormat } = useModifiedTimeFormat();
  const { order: listingSortOrder } = useListingSortOrder();
  const { showDotEntries, toggleShowDotEntries } = useShowDotEntries();
  const { cardSize, setCardSize, resetToDefault } = useGridCardSize();
  const initialPath = useMemo(
    () => explorerPathFromPathname(window.location.pathname),
    [],
  );
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [listCursor, setListCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingLoadingOverlay, setListingLoadingOverlay] = useState(false);
  const [listingLoaded, setListingLoaded] = useState(false);
  const [kernelVersion, setKernelVersion] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [keyboardFocusVisible, setKeyboardFocusVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [touchPressHighlightPath, setTouchPressHighlightPath] =
    useState<string | null>(null);
  const [longPressArmed, setLongPressArmed] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [listingViewMode, setListingViewMode] = useState<ListingViewMode>(() =>
    readEffectiveFolderViewSettings(initialPath).viewMode,
  );
  const [gridResizeActive, setGridResizeActive] = useState(false);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const [columnSorting, setColumnSorting] = useState<SortingState>(() =>
    readEffectiveFolderViewSettings(initialPath).columnSort,
  );
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowPaths, setSlideshowPaths] = useState<string[]>([]);
  const [slideshowStartPath, setSlideshowStartPath] = useState<string | null>(null);
  const [slideshowHonorStartPath, setSlideshowHonorStartPath] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState("");
  const quickFilterInputRef = useRef<HTMLInputElement>(null);
  const uploadIndicatorRef = useRef<UploadIndicatorHandle>(null);
  const listingViewportRef = useRef<HTMLDivElement | null>(null);
  const listingMarqueeLayoutRef = useRef<ListingMarqueeLayoutResolver | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const selectionAnchorRef = useRef(0);
  const currentPathRef = useRef(currentPath);
  const listingEntriesRef = useRef<ListingEntry[]>([]);
  const selectedIndexRef = useRef(selectedIndex);
  const selectedPathsRef = useRef(selectedPaths);
  const selectedPathRef = useRef(selectedPath);
  const selectionModeRef = useRef(selectionMode);
  const lastListingPointerTypeRef = useRef("mouse");
  const listingLoadGenerationRef = useRef(0);
  const listingNavigationSnapshotRef = useRef<ListingNavigationSnapshot | null>(null);
  const entriesRef = useRef(entries);
  const listCursorRef = useRef(listCursor);
  const listingLoadedRef = useRef(listingLoaded);
  const listingLoadingOverlayTimerRef = useRef<number | null>(null);
  const openContextMenuRef = useRef<
    (event: ContextMenuPointerEvent, path: string | null) => void
  >(() => {});
  const beginTouchPressHighlightRef = useRef<(path: string | null) => void>(() => {});
  const armLongPressRangeRef = useRef<(path: string | null) => boolean>(() => false);
  const extendLongPressRangeRef = useRef<(targetPath: string | null) => void>(() => {});
  const endTouchPressHighlightRef = useRef<() => void>(() => {});
  const armedRangeSessionRef = useRef<{
    base: Set<string>;
    mode: ArmedRangeMode;
    anchorPath: string;
    anchorIndex: number;
  } | null>(null);
  currentPathRef.current = currentPath;
  entriesRef.current = entries;
  listCursorRef.current = listCursor;
  listingLoadedRef.current = listingLoaded;
  selectedIndexRef.current = selectedIndex;
  selectedPathsRef.current = selectedPaths;
  selectedPathRef.current = selectedPath;
  selectionModeRef.current = selectionMode;

  const notifyStorageError = useCallback(
    (err: unknown) => {
      if (cloudAuth.expired || cloudAuth.handleAuthError(err)) {
        return;
      }
      notifyError(err instanceof Error ? err.message : String(err));
    },
    [cloudAuth.expired, cloudAuth.handleAuthError],
  );

  const clearListingLoadingOverlayTimer = useCallback(() => {
    if (listingLoadingOverlayTimerRef.current != null) {
      window.clearTimeout(listingLoadingOverlayTimerRef.current);
      listingLoadingOverlayTimerRef.current = null;
    }
  }, []);

  const scheduleListingLoadingOverlay = useCallback(
    (generation: number) => {
      clearListingLoadingOverlayTimer();
      setListingLoadingOverlay(false);
      listingLoadingOverlayTimerRef.current = window.setTimeout(() => {
        listingLoadingOverlayTimerRef.current = null;
        if (generation === listingLoadGenerationRef.current) {
          setListingLoadingOverlay(true);
        }
      }, ASYNC_VISUAL_DELAY_MS);
    },
    [clearListingLoadingOverlayTimer],
  );

  const loadListing = useCallback(async (path: string, options?: { preserveSelection?: boolean; focusPath?: string }): Promise<boolean> => {
    if (cloudAuth.expired) {
      return false;
    }
    const generation = ++listingLoadGenerationRef.current;
    const previousPath = options?.preserveSelection ? null : currentPathRef.current;
    const refreshSelection = options?.preserveSelection
      ? selectionSnapshotForRefresh(
          selectedPathsRef.current,
          selectedPathRef.current,
        )
      : null;
    const previousPaths = refreshSelection?.previousPaths ?? null;
    const previousPathForSelection = refreshSelection?.focusPath ?? null;
    setListingLoading(true);
    scheduleListingLoadingOverlay(generation);
    if (!options?.preserveSelection) {
      listingNavigationSnapshotRef.current = captureListingNavigationSnapshot({
        path: currentPathRef.current,
        entries: entriesRef.current,
        listCursor: listCursorRef.current,
        listingLoaded: listingLoadedRef.current,
      });
      setListingLoaded(false);
      setCurrentPath(path);
    } else {
      listingNavigationSnapshotRef.current = null;
    }
    try {
      const { entries: data, nextCursor } = await backend.list(path);
      if (generation !== listingLoadGenerationRef.current) {
        return false;
      }
      setEntries(data);
      setListCursor(nextCursor);
      setCurrentPath(path);
      const restored = options?.focusPath
        ? restoreSelectionFromListing(data, new Set([options.focusPath]), options.focusPath)
        : previousPaths != null
          ? restoreSelectionFromListing(data, previousPaths, previousPathForSelection)
          : null;
      if (restored) {
        setKeyboardFocusVisible(false);
        setSelectedIndex(restored.index);
        setSelectedPath(restored.focusPath);
        setSelectedPaths(restored.paths);
        selectionAnchorRef.current = restored.index;
      } else if (previousPaths != null && previousPaths.size > 0) {
        setKeyboardFocusVisible(false);
        setSelectedIndex(0);
        setSelectedPath(null);
        setSelectedPaths(new Set());
      } else {
        setKeyboardFocusVisible(false);
        setSelectedIndex(0);
        setSelectedPath(null);
        setSelectedPaths(new Set());
      }
      return true;
    } catch (err) {
      if (generation !== listingLoadGenerationRef.current) {
        return false;
      }
      if (previousPath != null) {
        setCurrentPath(previousPath);
      }
      if (err instanceof Response) {
        await notifyApiError(err, t);
        return false;
      }
      notifyStorageError(err);
      return false;
    } finally {
      if (generation === listingLoadGenerationRef.current) {
        clearListingLoadingOverlayTimer();
        setListingLoadingOverlay(false);
        setListingLoading(false);
        setListingLoaded(true);
        listingNavigationSnapshotRef.current = null;
      }
    }
  }, [
    backend,
    clearListingLoadingOverlayTimer,
    cloudAuth.expired,
    notifyStorageError,
    scheduleListingLoadingOverlay,
    t,
  ]);

  useEffect(() => () => clearListingLoadingOverlayTimer(), [clearListingLoadingOverlayTimer]);

  const loadMoreEntries = useCallback(async () => {
    if (cloudAuth.expired || !listCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const { entries: data, nextCursor } = await backend.list(currentPathRef.current, listCursor);
      setEntries((current) => [...current, ...data]);
      setListCursor(nextCursor);
    } catch (err) {
      notifyStorageError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, cloudAuth.expired, listCursor, loadingMore, notifyStorageError]);

  useEffect(() => {
    if (cloudAuth.expired) {
      return;
    }
    loadListing(initialPath).catch((err: unknown) => notifyStorageError(err));
    void backend
      .fetchHealth()
      .then((data) => {
        if (data) {
          setReadOnly(data.read_only ?? false);
        }
      })
      .catch(() => {});
  }, [backend, cloudAuth.expired, initialPath, loadListing, notifyStorageError]);

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
    clearDone: clearDoneUpload,
    conflictItem: uploadConflictItem,
  } = useUploadQueue({
    backend,
    readOnly,
    onItemComplete: () => {
      loadListing(currentPathRef.current, { preserveSelection: true }).catch(
        (err: unknown) => notifyStorageError(err),
      );
    },
    onItemFailed: (message, err) => {
      if (err && cloudAuth.handleAuthError(err)) {
        return;
      }
      notifyError(message);
    },
    onMultipartSessionFinished: (uploadId) => {
      void multipartSessionsRef.current.onUploadSessionFinished(uploadId);
    },
    onTusSessionFinished: (uploadId, destPath) => {
      void tusSessionsRef.current.onUploadSessionFinished(uploadId, destPath);
    },
    onTusSessionsChanged: () => {
      void tusSessionsRef.current.refresh();
    },
  });

  const multipartSessionsRef = useRef({
    onUploadSessionFinished: async (_uploadId: string) => {},
  });
  const tusSessionsRef = useRef({
    onUploadSessionFinished: async (_uploadId: string, _destPath?: string) => {},
    refresh: async () => {},
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
            (err: unknown) => notifyStorageError(err),
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
    [applyRemoteProgress, loadListing, notifyStorageError],
  );

  const backendStatus = useBackendStatus(handleKernelEvent);
  const { mode: themeMode, resolved: resolvedTheme, setMode: setThemeMode } = useTheme();
  const { mode: uiMode, resolved: resolvedUiMode, setMode: setUiMode } = useUiMode();
  const touchUi = resolvedUiMode === "touch";
  const compactTouchChrome = useCompactTouchChrome(touchUi);
  const touchUiRef = useRef(touchUi);
  touchUiRef.current = touchUi;

  const refreshListing = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    void loadListing(currentPathRef.current, { preserveSelection: true })
      .catch((err: unknown) => notifyStorageError(err))
      .finally(() => setRefreshing(false));
  }, [loadListing, notifyStorageError, refreshing]);

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

  const cancelListingLoad = useCallback(() => {
    if (!listingLoading && !refreshing) {
      return;
    }
    listingLoadGenerationRef.current += 1;
    clearListingLoadingOverlayTimer();
    setListingLoadingOverlay(false);
    setListingLoading(false);
    setRefreshing(false);

    const snapshot = listingNavigationSnapshotRef.current;
    if (snapshot) {
      setCurrentPath(snapshot.path);
      trackCurrentPath(snapshot.path);
      setEntries(snapshot.entries);
      setListCursor(snapshot.listCursor);
      setListingLoaded(snapshot.listingLoaded);
      listingNavigationSnapshotRef.current = null;
    }
  }, [clearListingLoadingOverlayTimer, listingLoading, refreshing, trackCurrentPath]);

  useEffect(() => {
    setSelectionMode(false);
  }, [currentPath]);

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
        notifyStorageError(err);
      }
    },
    [backend, navigateTo, notifyStorageError, t],
  );

  const getOperationTargets = useCallback(() => {
    const selected = Array.from(selectedPathsRef.current);
    if (selected.length > 0) {
      return selected;
    }
    // Do not fall back to selectedIndex: after clearSelection it often remains 0,
    // so paste treated the first row as selected even when nothing was selected.
    const path = selectedPathRef.current;
    return path ? [path] : [];
  }, []);

  const getPrimaryPath = useCallback(() => selectedPathRef.current, []);

  const { isPending: operationPending, showPendingVisual, runWithPending } =
    useOperationPending();

  const fileOps = useExplorerFileOps({
    backend,
    readOnly,
    currentPath,
    entries,
    getTargets: getOperationTargets,
    getPrimaryPath,
    loadListing,
    t,
    runWithPending,
  });

  const runBulkAction = useCallback(
    async (actionId: string, paths: string[]) => {
      if (actionId === "copy-path") {
        try {
          await copyTextToClipboard(paths.join("\n"));
          toast.success(
            t(
              paths.length === 1
                ? "selection.copyPath.copied"
                : "selection.copyPaths.copied",
            ),
          );
        } catch {
          toast.error(t("selection.copyPath.copyFailed"));
        }
        return;
      }
      try {
        await backend.runAction({ actionId, paths });
      } catch (err) {
        if (cloudAuth.handleAuthError(err)) {
          return;
        }
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
    [backend, cloudAuth, fileOps, t, loadListing],
  );


  const toggleMultiSelect = useCallback((path: string) => {
    setKeyboardFocusVisible(false);
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
    setKeyboardFocusVisible(false);
    setSelectedPaths(new Set());
    setSelectedPath(null);
  }, []);

  useEffect(() => {
    if (touchUi) {
      return;
    }
    setSelectionMode(false);
    setTouchPressHighlightPath(null);
    setLongPressArmed(false);
    armedRangeSessionRef.current = null;
    clearSelection();
  }, [touchUi, clearSelection]);

  useEffect(() => {
    applySelectionModeShell(touchUi && selectionMode);
    return () => applySelectionModeShell(false);
  }, [touchUi, selectionMode]);

  useEffect(() => {
    if (
      !shouldClearTouchSelectionOutsideSelectionMode({
        touchUi,
        selectionMode,
        selectedCount: selectedPaths.size,
        lastPointerType: lastListingPointerTypeRef.current,
        contextMenuOpen: contextMenu != null,
      })
    ) {
      return;
    }
    clearSelection();
    // contextMenu is read for the open guard but intentionally omitted from deps:
    // re-running when the menu closes would clear the long-press target selection.
  }, [selectionMode, selectedPaths.size, clearSelection, touchUi]);

  const clearMultiSelection = useCallback(() => {
    setSelectedPaths((current) => (current.size === 0 ? current : new Set()));
  }, []);

  const actionLabel = useCallback(
    (key: string) => t(key as MessageKey),
    [t],
  );

  const getPreviewPaths = useCallback(() => {
    const listing = listingEntriesRef.current;
    const fromSelection = resolveViewerPreviewPaths(
      Array.from(selectedPathsRef.current),
      listing,
    );
    if (fromSelection.length > 0) {
      return fromSelection;
    }
    const focused = selectedPathRef.current;
    if (focused && listing.some((entry) => entry.path === focused && !entry.isDir)) {
      return [focused];
    }
    return [];
  }, []);

  const openPreview = useCallback((
    paths: string[],
    startPath: string | null,
    options?: { honorStartPath?: boolean },
  ) => {
    setSlideshowHonorStartPath(options?.honorStartPath ?? false);
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

  const selectedFileCount = useMemo(
    () => filterDownloadablePaths(Array.from(selectedPaths), entries).length,
    [selectedPaths, entries],
  );

  const entryByPath = useMemo(
    () => new Map(entries.map((entry) => [entry.path, entry])),
    [entries],
  );

  const statusTextTranslate = useCallback(
    (key: string, params?: Record<string, string>) => t(key as MessageKey, params),
    [t],
  );

  const selectionStatusText = useMemo(
    () =>
      formatSelectionStatusLabel(
        countSelectedFileFolders(Array.from(selectedPaths), entryByPath),
        statusTextTranslate,
      ),
    [selectedPaths, entryByPath, statusTextTranslate],
  );

  const cutStatusText = useMemo(() => {
    if (fileOps.cutPaths.length === 0) {
      return null;
    }
    const singleItemName =
      fileOps.cutPaths.length === 1 ? basename(fileOps.cutPaths[0] ?? "") : null;
    return formatCutStatusLabel(
      countSelectedFileFolders(fileOps.cutPaths, entryByPath),
      singleItemName,
      statusTextTranslate,
    );
  }, [fileOps.cutPaths, entryByPath, statusTextTranslate]);

  const viewerPreviewCount = useMemo(() => {
    const listingSource = quickFilteredEntries.map((entry) => ({
      path: entry.path,
      isDir: entry.is_dir,
    }));
    const fromSelection = resolveViewerPreviewPaths(
      Array.from(selectedPaths),
      listingSource,
    );
    if (fromSelection.length > 0) {
      return fromSelection.length;
    }
    if (
      selectedPath &&
      listingSource.some((entry) => entry.path === selectedPath && !entry.isDir)
    ) {
      return 1;
    }
    return 0;
  }, [selectedPaths, selectedPath, quickFilteredEntries]);

  const contextKeys = useMemo<ContextKeys>(
    () => ({
      "focus.pane": "file-list",
      "selection.count": selectedPaths.size,
      "selection.file-count": selectedFileCount,
      "selection.paths": Array.from(selectedPaths),
      "current-path": currentPath,
      "connection.online": backendStatus === "connected",
      "server.read-only": readOnly,
      "clipboard.count": fileOps.clipboard?.paths.length ?? 0,
      "preview.is-image": selectedPath ? isImagePath(selectedPath) : false,
      "preview.path": selectedPath ?? "",
      "viewer.preview-count": viewerPreviewCount,
      "listing.show-dot-entries": showDotEntries,
      "listing.loaded": listingLoaded,
      "listing.visible-count": quickFilteredEntries.length,
      "listing.view": listingViewMode,
      "slideshow.open": slideshowOpen,
      "preview.info-open": infoDialogOpen,
      "operation.pending": operationPending,
      "navigation.can-go-back": canGoBack,
      "navigation.can-go-forward": canGoForward,
      "navigation.loading": refreshing || listingLoading,
      "cloud.connected": onCloudDisconnect != null,
      "ui.touch": touchUi,
    }),
    [
      selectedPaths,
      selectedFileCount,
      currentPath,
      backendStatus,
      readOnly,
      selectedPath,
      showDotEntries,
      viewerPreviewCount,
      fileOps.clipboard,
      listingLoaded,
      quickFilteredEntries.length,
      listingViewMode,
      slideshowOpen,
      infoDialogOpen,
      operationPending,
      canGoBack,
      canGoForward,
      refreshing,
      listingLoading,
      onCloudDisconnect,
      touchUi,
    ],
  );

  const infoDialogPaths = useMemo(() => Array.from(selectedPaths), [selectedPaths]);

  const gridColumnCount = useMemo(
    () => computeGridColumnCount(gridViewportWidth, cardSize.width, GRID_GAP_PX),
    [gridViewportWidth, cardSize.width],
  );
  const gridColumnCountRef = useRef(gridColumnCount);
  gridColumnCountRef.current = gridColumnCount;
  const listingViewModeRef = useRef(listingViewMode);
  listingViewModeRef.current = listingViewMode;
  const listingSortOrderRef = useRef(listingSortOrder);
  listingSortOrderRef.current = listingSortOrder;
  const columnSortingRef = useRef(columnSorting);
  columnSortingRef.current = columnSorting;
  const cardSizeRef = useRef(cardSize);
  cardSizeRef.current = cardSize;

  useEffect(() => {
    if (!listingLoaded) {
      return;
    }
    const effective = readEffectiveFolderViewSettings(currentPath);
    setListingViewMode(effective.viewMode);
    setColumnSorting(effective.columnSort);
    setCardSize(effective.gridCardSize);
  }, [currentPath, listingLoaded, setCardSize]);

  const handleListingViewModeChange = useCallback(
    (mode: ListingViewMode, options?: { global?: boolean }) => {
      setListingViewMode(mode);
      if (options?.global) {
        applyGlobalListingSettings({
          viewMode: mode,
          columnSort: columnSortingRef.current,
          gridCardSize: cardSizeRef.current,
        });
        return;
      }
      writeFolderViewOverride(currentPathRef.current, { viewMode: mode });
    },
    [],
  );

  const toggleListingViewModeHandler = useCallback((options?: { global?: boolean }) => {
    handleListingViewModeChange(nextListingViewMode(listingViewModeRef.current), options);
  }, [handleListingViewModeChange]);

  const applyGlobalListingSettingsHandler = useCallback(() => {
    applyGlobalListingSettings({
      viewMode: listingViewModeRef.current,
      columnSort: columnSortingRef.current,
      gridCardSize: cardSizeRef.current,
    });
  }, []);

  const handleColumnSortingChange = useCallback<OnChangeFn<SortingState>>((updater) => {
    setColumnSorting((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeFolderViewOverride(currentPathRef.current, { columnSort: next });
      return next;
    });
  }, []);

  const handleCardSizeChange = useCallback(
    (size: GridCardSize) => {
      setCardSize(size);
      writeFolderViewOverride(currentPathRef.current, { gridCardSize: size });
    },
    [setCardSize],
  );

  const handleResetGridCardSize = useCallback(() => {
    resetToDefault();
    clearFolderGridCardSizeOverride(currentPathRef.current);
  }, [resetToDefault]);

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

  const listingPaneOverlay = listingPaneOverlayKey({
    showListingLoadingOverlay: listingLoadingOverlay,
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
      if (
        slideshowOpen ||
        !isQuickFilterTypeaheadKey(event) ||
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
  }, [slideshowOpen]);

  const listingEntries = useMemo((): Array<ListingEntry> => {
    return quickFilteredEntries.map((entry) => {
      const activateEntry = () => {
        if (selectionModeRef.current) {
          return;
        }
        if (entry.is_dir) {
          navigateTo(entry.path);
          return;
        }
        const selected = Array.from(selectedPathsRef.current);
        const paths = resolveViewerPreviewPaths(
          selected.length > 0 ? selected : [],
          listingEntriesRef.current,
        );
        openPreview(
          paths.length > 0 ? paths : [entry.path],
          entry.path,
          { honorStartPath: true },
        );
      };

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
          const rows = listingEntriesRef.current;
          let nextSelectedPath: string | null = entry.path;
          const clearingSelection = shouldClearTouchSelectionOnBrowse({
            touchUi: touchUiRef.current,
            selectionMode: selectionModeRef.current,
            selectedCount: selectedPathsRef.current.size,
          });
          const touchTapActivate = shouldTouchTapActivate({
            touchUi: touchUiRef.current,
            selectionMode: selectionModeRef.current,
          });

          if (clearingSelection) {
            setSelectedPaths(new Set());
            setSelectedPath(null);
          }

          if (touchTapActivate) {
            activateEntry();
            return;
          }

          setKeyboardFocusVisible(false);

          if (selectionModeRef.current) {
            if (event.shiftKey) {
              setSelectedPaths(
                pathsInIndexRange(rows, selectionAnchorRef.current, displayIndex),
              );
              setSelectedIndex(displayIndex);
              setSelectedPath(entry.path);
              return;
            }
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
            setSelectedIndex(displayIndex);
            setSelectedPath(nextSelectedPath);
            selectionAnchorRef.current = displayIndex;
            return;
          }

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
        onActivate: activateEntry,
        onContextMenu: (event) => {
          event.stopPropagation();
          if (touchUiRef.current) {
            event.preventDefault();
            return;
          }
          void openContextMenuRef.current(event, entry.path);
        },
      };
      return listingEntry;
    });
  }, [
    quickFilteredEntries,
    quickFilterActive,
    quickFilter,
    navigateTo,
    openPreview,
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
    setKeyboardFocusVisible(false);
    setSelectedPaths(paths);
    if (paths.size === 0) {
      setSelectedPath(null);
      return;
    }
    const rows = listingEntriesRef.current;
    const prevSelectedPath = selectedPathRef.current;
    // selectedPath must remain a still-selected entry (status / actions).
    const focusPath =
      primaryPath && paths.has(primaryPath)
        ? primaryPath
        : prevSelectedPath && paths.has(prevSelectedPath)
          ? prevSelectedPath
          : ([...paths].find((path) =>
              rows.some((entry) => entry.path === path),
            ) ?? null);
    if (!focusPath) {
      setSelectedPath(null);
      return;
    }
    // selectedIndex follows the finger/primary when provided so range gestures
    // do not jump focus to an arbitrary remaining selection (which also used to
    // scroll that row into view on touch).
    const primaryIndex =
      primaryPath != null
        ? rows.findIndex((entry) => entry.path === primaryPath)
        : -1;
    const focusIndex =
      primaryIndex >= 0
        ? primaryIndex
        : rows.findIndex((entry) => entry.path === focusPath);
    setSelectedPath(focusPath);
    if (focusIndex >= 0) {
      setSelectedIndex(focusIndex);
      selectionAnchorRef.current = focusIndex;
    }
  }, []);

  const onListingEmptyClickRef = useRef<() => void>(() => {});

  const marqueeSelect = useListingMarqueeSelect({
    selectedPaths,
    enabled:
      listingLoaded &&
      !listingLoading &&
      !listingPaneOverlay &&
      activeListingEntries.length > 0 &&
      !gridResizeActive,
    allowEmptyClickClear: !selectionMode,
    scrollElementRef: listingViewportRef,
    layoutRef: listingMarqueeLayoutRef,
    onSelectionChange: applyMarqueeSelection,
    onEmptyClick: () => onListingEmptyClickRef.current(),
  });

  const longPressRangeSelect = useListingLongPressRangeSelect({
    enabled:
      listingLoaded &&
      !listingLoading &&
      !listingPaneOverlay &&
      activeListingEntries.length > 0 &&
      !gridResizeActive,
    touchUi,
    scrollElementRef: listingViewportRef,
    layoutRef: listingMarqueeLayoutRef,
    onPressStart: (path) => beginTouchPressHighlightRef.current(path),
    onLongPress: (path) => armLongPressRangeRef.current(path),
    onSwipeExtend: (targetPath) => extendLongPressRangeRef.current(targetPath),
    onGestureEnd: () => endTouchPressHighlightRef.current(),
  });

  const onListingViewportPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      lastListingPointerTypeRef.current = event.pointerType;
      longPressRangeSelect.onViewportPointerDown(event);
      marqueeSelect.onViewportPointerDown(event);
    },
    [
      longPressRangeSelect.onViewportPointerDown,
      marqueeSelect.onViewportPointerDown,
    ],
  );

  const shouldSkipDoubleClickActivate = useCallback(
    () => touchUiRef.current,
    [],
  );

  const handleInlineCommit = useCallback(
    (path: string, name: string) => {
      void fileOps.commitRename(path, name).then((ok) => {
        if (ok) {
          fileOps.setInlineEditPath(null);
        }
      });
    },
    [fileOps.commitRename, fileOps.setInlineEditPath],
  );

  const handleInlineCancel = useCallback(
    (path: string, initialName: string) => {
      void fileOps.cancelInlineEdit(path, initialName);
    },
    [fileOps.cancelInlineEdit],
  );

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
      setKeyboardFocusVisible(false);
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
      setKeyboardFocusVisible(
        keyboardFocusVisibleAfterListingMove(options?.extendRange === true),
      );
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
    setKeyboardFocusVisible(false);
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
      try {
        await downloadFiles(backend, paths);
      } catch (err) {
        notifyStorageError(err);
      }
    },
    [backend, notifyStorageError],
  );

  const toggleSelectionModeHandler = useCallback(() => {
    setSelectionMode((current) => {
      const next = !current;
      if (current) {
        clearSelection();
        setTouchPressHighlightPath(null);
        setLongPressArmed(false);
        armedRangeSessionRef.current = null;
      }
      return next;
    });
  }, [clearSelection]);

  const beginTouchPressHighlight = useCallback((path: string | null) => {
    setTouchPressHighlightPath(path);
  }, []);
  beginTouchPressHighlightRef.current = beginTouchPressHighlight;

  const armLongPressRange = useCallback(
    (path: string | null): boolean => {
      const action = longPressGestureAction({
        selectionMode: selectionModeRef.current,
        hasPath: path != null,
      });
      if (action === "none") {
        return false;
      }
      if (action === "enter-select-mode") {
        setSelectionMode(true);
      }
      // Entering select mode starts from an empty base so the long-pressed
      // item becomes the sole selection, matching the previous behavior.
      const base =
        action === "enter-select-mode"
          ? new Set<string>()
          : new Set(selectedPathsRef.current);
      if (path == null) {
        setSelectedPaths(new Set());
        setSelectedPath(null);
        return false;
      }
      const anchorIndex = listingEntriesRef.current.findIndex(
        (row) => row.path === path,
      );
      if (anchorIndex < 0) {
        return false;
      }
      const mode = resolveArmedRangeMode({ baseSelection: base, anchorPath: path });
      const next = armedRangeSelection(base, new Set([path]), mode);
      // Always pass the pressed path so selectedIndex tracks the finger even in
      // subtract mode (where the path is removed from the selection set).
      applyMarqueeSelection(next, path);
      navigator.vibrate?.(10);
      armedRangeSessionRef.current = { base, mode, anchorPath: path, anchorIndex };
      setLongPressArmed(true);
      return true;
    },
    [applyMarqueeSelection],
  );
  armLongPressRangeRef.current = armLongPressRange;

  const extendLongPressRange = useCallback(
    (targetPath: string | null) => {
      const armed = armedRangeSessionRef.current;
      if (!armed) {
        return;
      }
      const range = swipeRangeFromAnchor(
        listingEntriesRef.current,
        armed.anchorIndex,
        targetPath,
      );
      const next = armedRangeSelection(armed.base, range, armed.mode);
      // Track the finger (or anchor) for selectedIndex even when subtract removes it.
      const primaryPath = targetPath ?? armed.anchorPath;
      applyMarqueeSelection(next, primaryPath);
      setTouchPressHighlightPath(
        resolveLongPressGestureHighlightPath({
          targetPath,
          anchorPath: armed.anchorPath,
        }),
      );
    },
    [applyMarqueeSelection],
  );
  extendLongPressRangeRef.current = extendLongPressRange;

  const endTouchPressHighlight = useCallback(() => {
    armedRangeSessionRef.current = null;
    setLongPressArmed(false);
    setTouchPressHighlightPath(null);
  }, []);
  endTouchPressHighlightRef.current = endTouchPressHighlight;

  const focusQuickFilter = useCallback(() => {
    const input = quickFilterInputRef.current;
    input?.focus();
    input?.select();
  }, []);

  const confirmMessageRef = useRef<
    (messageKey: string, params?: Record<string, string>) => Promise<boolean>
  >(async () => false);

  const actionSystem = useActionSystem(
    contextKeys,
    {
      getListingLength: () => listingEntriesRef.current.length,
      getListingViewMode: () => listingViewModeRef.current,
      getGridColumnCount: () => gridColumnCountRef.current,
      getGridSectionFolderCount: () => {
        if (listingViewModeRef.current !== "grid") {
          return 0;
        }
        return resolveGridSectionFolderCount(
          listingEntriesRef.current,
          listingSortOrderRef.current,
        );
      },
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
      runWithPending,
      selectAllVisible,
      openSettings: () => navigate("settings"),
      toggleShowDotEntries,
      toggleListingViewMode: toggleListingViewModeHandler,
      applyGlobalListingSettings: applyGlobalListingSettingsHandler,
      resetGridCardSize: handleResetGridCardSize,
      toggleSelectionMode: toggleSelectionModeHandler,
    },
    () => ({
      getPreviewPaths,
      getCurrentPreviewPath: () => selectedPathRef.current,
      openPreview,
    }),
    () => ({
      toggleInfoDialog: () => setInfoDialogOpen((open) => !open),
    }),
    () => ({
      openAbout: () => setAboutOpen(true),
      openKeyboardShortcuts: () => setKeyboardShortcutsOpen(true),
    }),
    () => ({
      getThemeMode: () => themeMode,
      setThemeMode,
      getUiMode: () => uiMode,
      setUiMode,
      getLocale: () => locale,
      setLocale,
    }),
    () => ({
      goBack: () => void goBack(),
      goForward: () => void goForward(),
      refreshListing,
      cancelListingLoad,
      focusQuickFilter,
    }),
    () => ({
      openUploadPanel: () => uploadIndicatorRef.current?.togglePanel(),
      chooseUploadFiles: () => uploadIndicatorRef.current?.chooseFiles(),
    }),
    onCloudDisconnect
      ? () => ({
          shareUrl: async () => {
            if (!cloudSessionConfig) {
              return;
            }
            const url = buildShareUrl(connectionConfigToShareInput(cloudSessionConfig), {
              explorerPath: currentPathRef.current,
              includeCredentials: readShareUrlIncludeCredentials(),
              origin: window.location.origin,
              base: appBasePath(),
            });
            try {
              await navigator.clipboard.writeText(url);
              toast.success(t("connect.shareUrl.copied"));
            } catch {
              toast.error(t("connect.shareUrl.copyFailed"));
            }
          },
          disconnect: onCloudDisconnect,
        })
      : undefined,
  );
  confirmMessageRef.current = actionSystem.confirmMessage;

  const openContextMenu = useCallback(
    async (event: ContextMenuPointerEvent, path: string | null) => {
      if (touchUiRef.current) {
        return;
      }
      event.preventDefault();

      if (path == null) {
        setKeyboardFocusVisible(false);
        setSelectedPaths(new Set());
        setSelectedPath(null);
      } else if (!selectedPathsRef.current.has(path)) {
        const rows = listingEntriesRef.current;
        const displayIndex = rows.findIndex((row) => row.path === path);
        setKeyboardFocusVisible(false);
        setSelectedPaths(new Set([path]));
        setSelectedPath(path);
        if (displayIndex >= 0) {
          setSelectedIndex(displayIndex);
          selectionAnchorRef.current = displayIndex;
        }
      }

      const menuSelectedPaths =
        path == null
          ? new Set<string>()
          : !selectedPathsRef.current.has(path)
            ? new Set([path])
            : selectedPathsRef.current;

      const menuContextKeys = buildContextMenuContextKeys({
        baseContextKeys: contextKeys,
        targetPath: path,
        selectedPaths: menuSelectedPaths,
        listingRows: listingEntriesRef.current,
      });

      const menuActions = resolveContextMenuActions({
        registry: actionSystem.registry,
        contextKeys: menuContextKeys,
        entries,
        keybindings: actionSystem.keybindings,
        userKeybindings: actionSystem.userKeybindings,
        labelForAction: actionLabel,
        t: (key, params) => t(key, params),
        targetPath: path,
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
      t,
    ],
  );
  openContextMenuRef.current = openContextMenu;

  const selectModeMenuTargetPath = useMemo(() => {
    if (selectedPaths.size === 0) {
      return null;
    }
    return selectedPath ?? Array.from(selectedPaths)[0] ?? null;
  }, [selectedPaths, selectedPath]);

  const selectModeActions = useMemo(
    () =>
      selectionMode && touchUi
        ? resolveContextMenuActions({
            registry: actionSystem.registry,
            contextKeys,
            entries,
            keybindings: actionSystem.keybindings,
            userKeybindings: actionSystem.userKeybindings,
            labelForAction: actionLabel,
            t: (key, params) => t(key, params),
            targetPath: selectModeMenuTargetPath,
          })
        : [],
    [
      selectionMode,
      touchUi,
      actionSystem.registry,
      actionSystem.keybindings,
      actionSystem.userKeybindings,
      contextKeys,
      entries,
      actionLabel,
      t,
      selectModeMenuTargetPath,
    ],
  );

  const blockSelectionClearRef = useRef(false);
  blockSelectionClearRef.current =
    actionSystem.paletteOpen ||
    actionSystem.confirmState != null ||
    contextMenu != null ||
    slideshowOpen ||
    infoDialogOpen ||
    uploadConflictItem != null ||
    fileOps.pasteDestOpen ||
    fileOps.pasteConflict != null ||
    fileOps.inlineEditPath != null ||
    marqueeSelect.isActive;

  onListingEmptyClickRef.current = () => {
    if (blockSelectionClearRef.current) {
      return;
    }
    if (selectedPathsRef.current.size === 0) {
      return;
    }
    clearMultiSelection();
  };

  useEffect(() => {
    const shouldIgnoreTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return true;
      }
      if (target.closest("[data-listing-entry]")) {
        return true;
      }
      if (target.closest("[data-listing-viewport]")) {
        return true;
      }
      if (target.closest('[role="dialog"]')) {
        return true;
      }
      if (target.closest('[role="toolbar"]')) {
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
      if (selectionModeRef.current) {
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
    if (selectedPathsRef.current.size === 0) {
      return;
    }
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

  const entryDragEnabled = !touchUi && !readOnly && !operationPending;
  const pastePathsToDir = fileOps.pastePathsToDir;
  const onExplorerDropPaths = useCallback(
    (
      paths: string[],
      operation: "copy" | "cut",
      destDir: string,
    ) => {
      void pastePathsToDir(paths, operation, destDir);
    },
    [pastePathsToDir],
  );

  const listingFocusedPath = resolveListingFocusedPath({
    touchUi,
    selectedPath,
    keyboardFocusVisible,
  });
  const gestureInsetPath =
    longPressArmed && touchPressHighlightPath != null
      ? touchPressHighlightPath
      : null;

  const statusBarElement = (
    <StatusBar
      backendStatus={backendStatus}
      backendMode={backend.mode}
      cloudProvider={cloudSessionConfig?.provider ?? null}
      kernelVersion={kernelVersion}
      readOnly={readOnly}
      compactTouchChrome={compactTouchChrome}
      selectionModeActive={touchUi && selectionMode}
      selectionStatusText={selectionStatusText}
      cutStatusText={cutStatusText}
    />
  );

  const touchSelectModeToggle = touchUi && !selectionMode ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl touch-ui:h-11 touch-ui:w-11"
          aria-label={t("selection.mode.enter")}
          onClick={() => void actionSystem.invoke("selection.toggle-mode")}
        >
          <ListChecks className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("selection.mode.enter")}</TooltipContent>
    </Tooltip>
  ) : null;

  const selectModeToolbarElement = (
    <SelectModeActionToolbar
      actions={selectModeActions}
      doneLabel={t("selection.mode.done")}
      overflowLabel={t("actions.selectModeToolbar.overflow")}
      ariaLabel={t("actions.selectModeToolbar.label")}
      onDone={() => void actionSystem.invoke("selection.toggle-mode")}
      invoke={(id) => void actionSystem.invoke(id)}
    />
  );

  const addressBarSection = (
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
        cancelLabel={t("breadcrumb.cancel")}
        listingLoading={refreshing || listingLoading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={() => void actionSystem.invoke("navigation.back")}
        onForward={() => void actionSystem.invoke("navigation.forward")}
        onRefresh={() => void actionSystem.invoke("navigation.refresh")}
        onCancel={() => void actionSystem.invoke("navigation.cancel-load")}
        onNavigate={(path) => void navigateTo(path)}
        quickFilterLabel={t("quickFilter.label")}
        quickFilterPlaceholder={t("quickFilter.placeholder")}
        quickFilterClearLabel={t("quickFilter.clear")}
        quickFilterHelpText={t("quickFilter.help")}
        quickFilterValue={quickFilter}
        onQuickFilterChange={setQuickFilter}
        onQuickFilterKeyDown={handleQuickFilterKeyDown}
        quickFilterInputRef={quickFilterInputRef}
        showNavButtons={!compactTouchChrome}
        pathDropEnabled={entryDragEnabled}
      />
    </section>
  );

  const compactToolbarElement = (
    <ExplorerCompactToolbar
      backLabel={t("breadcrumb.back")}
      forwardLabel={t("breadcrumb.forward")}
      refreshLabel={t("breadcrumb.refresh")}
      cancelLabel={t("breadcrumb.cancel")}
      listingLoading={refreshing || listingLoading}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onBack={() => void actionSystem.invoke("navigation.back")}
      onForward={() => void actionSystem.invoke("navigation.forward")}
      onRefresh={() => void actionSystem.invoke("navigation.refresh")}
      onCancel={() => void actionSystem.invoke("navigation.cancel-load")}
      ariaLabel={t("actions.toolbar.label")}
      trailingActions={
        selectionMode && touchUi ? (
          <SelectModeActionToolbar
            actions={selectModeActions}
            doneLabel={t("selection.mode.done")}
            overflowLabel={t("actions.selectModeToolbar.overflow")}
            ariaLabel={t("actions.selectModeToolbar.label")}
            onDone={() => void actionSystem.invoke("selection.toggle-mode")}
            invoke={(id) => void actionSystem.invoke(id)}
            embedded
          />
        ) : (
        <>
          {touchSelectModeToggle}
          <ActionToolbar
            registry={actionSystem.registry}
            contextKeys={contextKeys}
            keybindings={actionSystem.keybindings}
            labelForKey={actionLabel}
            invoke={(id) => void actionSystem.invoke(id)}
            ariaLabel={t("actions.toolbar.label")}
            embedded
          />
          <UploadIndicator
            ref={uploadIndicatorRef}
            items={uploadItems}
            onSelect={onUpload}
            readOnly={readOnly}
            onClearFinished={clearFinishedUploads}
            onClearDone={clearDoneUpload}
            onCancel={cancelUpload}
            onPause={pauseUpload}
            onResume={resumeUpload}
            onTrayClick={() => void actionSystem.invoke("file.upload-open-panel")}
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
          <ListingViewToggle
            mode={listingViewMode}
            onChange={(_mode, options) => {
              void actionSystem.invoke("view.toggle-listing-mode", {
                args: options?.global ? { global: true } : undefined,
              });
            }}
          />
          <MenuBar
            registry={actionSystem.registry}
            contextKeys={contextKeys}
            keybindings={actionSystem.keybindings}
            labelForKey={actionLabel}
            invoke={(id, options) => void actionSystem.invoke(id, options)}
            ariaLabel={t("actions.menuBar.label")}
            themeMode={themeMode}
            uiMode={uiMode}
            mobileMenuOnly
          />
        </>
        )
      }
    />
  );

  return (
    <ExplorerDndProvider
      enabled={entryDragEnabled}
      selectedPaths={selectedPaths}
      entryByPath={entryByPath}
      onDropPaths={onExplorerDropPaths}
    >
    <>
    <main className="flex h-dvh w-full flex-col gap-2 overflow-hidden bg-[var(--shell-background)] p-2 transition-colors duration-200">
      {!compactTouchChrome ? (
      <header className="shrink-0 space-y-4">
        {selectionMode && touchUi ? (
          selectModeToolbarElement
        ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MenuBar
            registry={actionSystem.registry}
            contextKeys={contextKeys}
            keybindings={actionSystem.keybindings}
            labelForKey={actionLabel}
            invoke={(id, options) => void actionSystem.invoke(id, options)}
            ariaLabel={t("actions.menuBar.label")}
            themeMode={themeMode}
            uiMode={uiMode}
          />
          <div className="flex flex-wrap items-center gap-0.5">
            <UploadIndicator
              ref={uploadIndicatorRef}
              items={uploadItems}
              onSelect={onUpload}
              readOnly={readOnly}
              onClearFinished={clearFinishedUploads}
              onClearDone={clearDoneUpload}
              onCancel={cancelUpload}
              onPause={pauseUpload}
              onResume={resumeUpload}
              onTrayClick={() => void actionSystem.invoke("file.upload-open-panel")}
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
            <ShowDotEntriesToggle
              onToggle={() => void actionSystem.invoke("view.toggle-dot-entries")}
            />
            <ListingViewToggle
              mode={listingViewMode}
              onChange={(_mode, options) => {
                void actionSystem.invoke("view.toggle-listing-mode", {
                  args: options?.global ? { global: true } : undefined,
                });
              }}
            />
            <ThemeToggle
              mode={themeMode}
              onChange={() => void actionSystem.invoke("appearance.cycle-theme")}
              variant="ghost"
            />
            <UiModeToggle
              mode={uiMode}
              onChange={() => void actionSystem.invoke("appearance.cycle-ui-mode")}
              variant="ghost"
            />
            <LanguageToggle
              iconOnly
              variant="ghost"
              onLocaleChange={(nextLocale) =>
                void actionSystem.invoke("appearance.set-locale", {
                  args: { locale: nextLocale },
                })
              }
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 touch-ui:h-11 touch-ui:w-11"
                  aria-label={t("settings.title")}
                  onClick={() => void actionSystem.invoke("navigation.open-settings")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("settings.title")}</TooltipContent>
            </Tooltip>
            {touchSelectModeToggle}
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
                    variant="ghost"
                    onShare={() => void actionSystem.invoke("cloud.share-url")}
                  />
                ) : null}
                <DisconnectButton
                  onClick={() => void actionSystem.invoke("cloud.disconnect")}
                />
              </>
            ) : null}
          </div>
        </div>
        )}
      </header>
      ) : null}

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

      <CloudAuthExpiredBanner />

      {compactTouchChrome ? (
        <section className="shrink-0">{statusBarElement}</section>
      ) : null}

      {!compactTouchChrome ? addressBarSection : null}

      <section
        ref={mainContentRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card"
      >
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            onContextMenu={(event) => {
              if (touchUi) {
                event.preventDefault();
                return;
              }
              if (
                event.target instanceof Element &&
                event.target.closest("[data-listing-entry]")
              ) {
                return;
              }
              void openContextMenuRef.current(event, null);
            }}
          >
            {listingPaneOverlay ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/60 px-4 text-center backdrop-blur-[1px]"
                role="status"
                aria-live="polite"
              >
                {listingPaneOverlay === "listing.loading" ? (
                  <>
                    <Loader2
                      className="size-6 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-muted-foreground">{t("listing.loading")}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t(listingPaneOverlay)}</p>
                )}
              </div>
            ) : null}
            <MarqueeOverlay rect={marqueeSelect.marqueeRect} />
            {listingViewMode === "grid" ? (
              <GridListing
                entries={listingEntries}
                selectedIndex={selectedIndex}
                focusedPath={listingFocusedPath}
                gestureHighlightPath={touchPressHighlightPath}
                gestureInsetPath={gestureInsetPath}
                scrollSelectedIntoView={!touchUi}
                multiSelectedPaths={selectedPaths}
                cutPaths={fileOps.cutPaths}
                inlineEditPath={fileOps.inlineEditPath}
                renameCommittingPath={fileOps.renameCommittingPath}
                showRenameBusyVisual={showPendingVisual}
                listingSortOrder={listingSortOrder}
                listingViewportRef={listingViewportRef}
                marqueeLayoutRef={listingMarqueeLayoutRef}
                onViewportPointerDown={onListingViewportPointerDown}
                onEntryPointerDown={longPressRangeSelect.onEntryPointerDown}
                entryDragEnabled={entryDragEnabled}
                marqueeActive={marqueeSelect.isActive}
                shouldSkipDoubleClickActivate={shouldSkipDoubleClickActivate}
                onResizeActiveChange={setGridResizeActive}
                onCardSizeChange={handleCardSizeChange}
                onResetCardSize={handleResetGridCardSize}
                onInlineCommit={handleInlineCommit}
                onInlineCancel={handleInlineCancel}
                ariaLabel={t("listing.label")}
                iconTheme={resolvedTheme}
                className="h-full rounded-none border-0 shadow-none"
              />
            ) : (
              <VirtualListing
                entries={listingEntries}
                selectedIndex={selectedIndex}
                focusedPath={listingFocusedPath}
                gestureHighlightPath={touchPressHighlightPath}
                gestureInsetPath={gestureInsetPath}
                scrollSelectedIntoView={!touchUi}
                multiSelectedPaths={selectedPaths}
                cutPaths={fileOps.cutPaths}
                inlineEditPath={fileOps.inlineEditPath}
                renameCommittingPath={fileOps.renameCommittingPath}
                showRenameBusyVisual={showPendingVisual}
                listingViewportRef={listingViewportRef}
                marqueeLayoutRef={listingMarqueeLayoutRef}
                onViewportPointerDown={onListingViewportPointerDown}
                onEntryPointerDown={longPressRangeSelect.onEntryPointerDown}
                entryDragEnabled={entryDragEnabled}
                marqueeActive={marqueeSelect.isActive}
                shouldSkipDoubleClickActivate={shouldSkipDoubleClickActivate}
                onInlineCommit={handleInlineCommit}
                onInlineCancel={handleInlineCancel}
                ariaLabel={t("listing.label")}
                iconTheme={resolvedTheme}
                className="h-full rounded-none border-0 shadow-none"
                columnLabels={listingColumnLabels}
                sorting={columnSorting}
                onSortingChange={handleColumnSortingChange}
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
        </div>
      </section>

      {!compactTouchChrome ? (
        <section className="shrink-0">{statusBarElement}</section>
      ) : null}

      {compactTouchChrome ? (
        <>
          {addressBarSection}
          {compactToolbarElement}
        </>
      ) : null}

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
        cancelLabel={t("actions.confirm.cancel")}
        continueLabel={t("actions.palette.continue")}
        currentLocale={locale}
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
        workingLabel={t("actions.confirm.working")}
        executing={fileOps.renameReplaceExecuting || actionSystem.confirmExecuting}
        showExecutingVisual={showPendingVisual}
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
          if (fileOps.renameReplaceExecuting || actionSystem.confirmExecuting) {
            return;
          }
          if (fileOps.renameReplace) {
            fileOps.setRenameReplace(null);
            return;
          }
          actionSystem.dismissConfirm(false);
        }}
        onConfirm={() => {
          if (fileOps.renameReplaceExecuting || actionSystem.confirmExecuting) {
            return;
          }
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
        labelForKey={actionLabel}
        currentLocale={locale}
        value={actionSystem.argPromptValue}
        onValueChange={actionSystem.setArgPromptValue}
        onCancel={() => actionSystem.dismissArgPrompt(null)}
        onSubmit={() => actionSystem.dismissArgPrompt(actionSystem.argPromptValue)}
      />

      <SlideshowOverlay
        open={slideshowOpen}
        paths={slideshowPaths}
        startPath={slideshowStartPath}
        honorStartPath={slideshowHonorStartPath}
        onOpenChange={setSlideshowOpen}
        onCurrentPathChange={handleSlideshowCurrentPathChange}
      />

      <InfoDialog
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        paths={infoDialogPaths}
        entries={entries}
        onSymlinkTargetClick={(resolvedPath) => void openSymlinkTarget(resolvedPath)}
      />

    </main>
    <Toaster richColors closeButton position="bottom-right" />
    </>
    </ExplorerDndProvider>
  );
}
