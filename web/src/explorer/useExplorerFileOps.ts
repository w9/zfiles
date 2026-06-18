import { useCallback, useRef, useState } from "react";

import type { ExplorerBackend } from "@/backend/types";
import type { FileEntry } from "@/backend/types";
import type { FileClipboard } from "@/fileOperations/clipboard";
import { performPaste, type PasteConflictRequest } from "@/fileOperations/performPaste";
import {
  basename,
  joinExplorerPath,
  parentExplorerPath,
  uniqueSiblingName,
} from "@/fileOperations/paths";
import { notifyError } from "@/notifyError";
import type { MessageKey } from "@/i18n";
import { useCloudAuth } from "@/cloud/CloudAuthContext";
import {
  readStoredPasteBatchOnError,
  type PasteBatchOnError,
} from "@/settings/pasteBatchOnError";
import { readStoredPasteDestination, storePasteDestination } from "@/settings/pasteDestination";
import type { PasteDestinationChoice } from "./PasteDestinationDialog";

const DEFAULT_FOLDER_NAMES = ["New Folder", "New folder"];

function defaultNewFolderName(existingNames: Set<string>): string {
  for (const candidate of DEFAULT_FOLDER_NAMES) {
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }
  return uniqueSiblingName("New Folder", existingNames);
}

export type ExplorerFileOpsDeps = {
  backend: ExplorerBackend;
  readOnly: boolean;
  currentPath: string;
  entries: FileEntry[];
  getTargets: () => string[];
  getPrimaryPath: () => string | null;
  loadListing: (path: string, options?: { preserveSelection?: boolean }) => Promise<boolean>;
  t: (key: MessageKey, params?: Record<string, string>) => string;
  runWithPending: (actionId: string, fn: () => Promise<void>) => Promise<void>;
};

export function useExplorerFileOps(deps: ExplorerFileOpsDeps) {
  const cloudAuth = useCloudAuth();
  const [clipboard, setClipboard] = useState<FileClipboard | null>(null);
  const [inlineEditPath, setInlineEditPath] = useState<string | null>(null);
  const [pasteDestOpen, setPasteDestOpen] = useState(false);
  const [pasteDestContext, setPasteDestContext] = useState<{
    folderName: string;
    currentFolderName: string;
    selectedFolderPath: string;
  } | null>(null);
  const [pasteConflict, setPasteConflict] = useState<PasteConflictRequest | null>(null);
  const [renameReplace, setRenameReplace] = useState<{
    path: string;
    newName: string;
  } | null>(null);
  const [renameCommittingPath, setRenameCommittingPath] = useState<string | null>(null);
  const [renameReplaceExecuting, setRenameReplaceExecuting] = useState(false);

  const pasteDestResolver = useRef<
    ((choice: PasteDestinationChoice | null, remember: boolean) => void) | null
  >(null);
  const pasteConflictResolver = useRef<
    ((resolution: "skip" | "replace" | "cancel") => void) | null
  >(null);

  const cutPaths = clipboard?.operation === "cut" ? clipboard.paths : [];

  const copySelection = useCallback(() => {
    const paths = deps.getTargets();
    if (paths.length === 0) {
      return;
    }
    setClipboard({ operation: "copy", paths });
  }, [deps]);

  const cutSelection = useCallback(() => {
    const paths = deps.getTargets();
    if (paths.length === 0) {
      return;
    }
    setClipboard({ operation: "cut", paths });
  }, [deps]);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  const resolvePasteDestDir = useCallback(async (): Promise<string | null> => {
    const targets = deps.getTargets();
    const selectedFolder =
      targets.length === 1
        ? deps.entries.find((entry) => entry.path === targets[0] && entry.is_dir)
        : undefined;

    if (!selectedFolder) {
      return deps.currentPath;
    }

    const preference = readStoredPasteDestination();
    if (preference === "into_selected_folder") {
      return selectedFolder.path;
    }
    if (preference === "into_current_directory") {
      return deps.currentPath;
    }

    return new Promise((resolve) => {
      pasteDestResolver.current = (choice, remember) => {
        if (!choice) {
          resolve(null);
          return;
        }
        if (remember) {
          storePasteDestination(choice);
        }
        resolve(
          choice === "into_selected_folder" ? selectedFolder.path : deps.currentPath,
        );
      };
      setPasteDestContext({
        folderName: selectedFolder.name,
        currentFolderName: basename(deps.currentPath) || deps.t("breadcrumb.root"),
        selectedFolderPath: selectedFolder.path,
      });
      setPasteDestOpen(true);
    });
  }, [deps]);

  const askPasteConflict = useCallback((request: PasteConflictRequest) => {
    return new Promise<"skip" | "replace" | "cancel">((resolve) => {
      pasteConflictResolver.current = resolve;
      setPasteConflict(request);
    });
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    if (!clipboard || clipboard.paths.length === 0) {
      return;
    }
    const destDir = await resolvePasteDestDir();
    if (destDir == null) {
      return;
    }

    const entriesByPath = new Map(deps.entries.map((entry) => [entry.path, entry]));
    const batchOnError: PasteBatchOnError = readStoredPasteBatchOnError();
    let result;
    try {
      result = await performPaste({
        backend: deps.backend,
        clipboard,
        destDir,
        listingEntries: deps.entries,
        allEntriesByPath: entriesByPath,
        batchOnError,
        askConflict: askPasteConflict,
      });
    } catch (err) {
      if (cloudAuth.handleAuthError(err)) {
        return;
      }
      notifyError(deps.t("error.actionFailed", { status: "failed" }));
      return;
    }

    if (result.cancelled) {
      return;
    }

    if (clipboard.operation === "cut" && result.succeeded.length > 0) {
      setClipboard(null);
    }

    await deps.loadListing(deps.currentPath, { preserveSelection: true });

    if (result.failed.length > 0 || result.succeeded.length > 0) {
      const parts: string[] = [];
      if (result.succeeded.length > 0) {
        parts.push(
          deps.t("paste.result.succeeded", {
            count: String(result.succeeded.length),
          }),
        );
      }
      if (result.failed.length > 0) {
        parts.push(
          deps.t("paste.result.failed", { count: String(result.failed.length) }),
        );
      }
      if (result.failed.length > 0) {
        notifyError(parts.join(" · "));
      }
    }
  }, [clipboard, cloudAuth, deps, askPasteConflict, resolvePasteDestDir]);

  const createNewFolder = useCallback(async () => {
    const existingNames = new Set(deps.entries.map((entry) => entry.name));
    const name = defaultNewFolderName(existingNames);
    try {
      await deps.backend.runAction({
        actionId: "file.mkdir",
        paths: [deps.currentPath],
        newName: name,
      });
    } catch (err) {
      if (cloudAuth.handleAuthError(err)) {
        return;
      }
      notifyError(deps.t("error.actionFailed", { status: "failed" }));
      return;
    }
    await deps.loadListing(deps.currentPath);
    const createdPath = joinExplorerPath(deps.currentPath, name);
    setInlineEditPath(createdPath);
  }, [cloudAuth, deps]);

  const commitRename = useCallback(
    async (path: string, newName: string, overwrite = false) => {
      if (!newName) {
        return false;
      }
      const currentName = basename(path);
      if (newName === currentName) {
        return true;
      }
      const nameTaken = deps.entries.some(
        (entry) => entry.name === newName && entry.path !== path,
      );
      if (nameTaken && !overwrite) {
        setRenameReplace({ path, newName });
        return false;
      }
      setRenameCommittingPath(path);
      try {
        let succeeded = false;
        await deps.runWithPending("file.rename", async () => {
          try {
            await deps.backend.runAction({
              actionId: "file.rename",
              paths: [path],
              newName,
              overwrite,
            });
          } catch (err) {
            if (cloudAuth.handleAuthError(err)) {
              return;
            }
            notifyError(deps.t("error.actionFailed", { status: "failed" }));
            return;
          }
          await deps.loadListing(deps.currentPath, { preserveSelection: true });
          succeeded = true;
        });
        return succeeded;
      } finally {
        setRenameCommittingPath(null);
      }
    },
    [cloudAuth, deps],
  );

  const startRename = useCallback(() => {
    const path = deps.getPrimaryPath();
    if (!path) {
      return;
    }
    setInlineEditPath(path);
  }, [deps]);

  const cancelInlineEdit = useCallback(
    async (path: string, initialName: string) => {
      setInlineEditPath(null);
      if (initialName.startsWith("New Folder") || initialName === "New folder") {
        const currentName = basename(path);
        if (DEFAULT_FOLDER_NAMES.includes(currentName)) {
          try {
            await deps.backend.runAction({
              actionId: "file.delete",
              paths: [path],
            });
            await deps.loadListing(deps.currentPath);
          } catch {
            // ignore cleanup errors
          }
        }
      }
    },
    [deps],
  );

  const onPasteDestinationChoose = useCallback(
    (choice: PasteDestinationChoice, remember: boolean) => {
      setPasteDestOpen(false);
      setPasteDestContext(null);
      pasteDestResolver.current?.(choice, remember);
      pasteDestResolver.current = null;
    },
    [],
  );

  const onPasteDestinationCancel = useCallback(() => {
    setPasteDestOpen(false);
    setPasteDestContext(null);
    pasteDestResolver.current?.(null, false);
    pasteDestResolver.current = null;
  }, []);

  const onPasteConflictResolve = useCallback(
    (resolution: "skip" | "replace" | "cancel") => {
      setPasteConflict(null);
      pasteConflictResolver.current?.(resolution);
      pasteConflictResolver.current = null;
    },
    [],
  );

  const confirmRenameReplace = useCallback(async () => {
    if (!renameReplace || renameReplaceExecuting) {
      return;
    }
    const { path, newName } = renameReplace;
    setRenameReplaceExecuting(true);
    try {
      const ok = await commitRename(path, newName, true);
      if (ok) {
        setInlineEditPath(null);
      }
    } finally {
      setRenameReplaceExecuting(false);
      setRenameReplace(null);
    }
  }, [renameReplace, renameReplaceExecuting, commitRename]);

  return {
    clipboard,
    cutPaths,
    inlineEditPath,
    setInlineEditPath,
    copySelection,
    cutSelection,
    clearClipboard,
    pasteFromClipboard,
    createNewFolder,
    startRename,
    commitRename,
    cancelInlineEdit,
    pasteDestOpen,
    pasteDestContext,
    onPasteDestinationChoose,
    onPasteDestinationCancel,
    pasteConflict,
    onPasteConflictResolve,
    renameReplace,
    setRenameReplace,
    renameReplaceExecuting,
    renameCommittingPath,
    confirmRenameReplace,
  };
}
