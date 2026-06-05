import type { ExplorerBackend } from "@/backend/types";
import type { FileEntry } from "@/backend/types";
import type { PasteBatchOnError } from "@/settings/pasteBatchOnError";
import type { FileClipboard } from "./clipboard";
import {
  basename,
  isDescendantPath,
  joinExplorerPath,
  parentExplorerPath,
  uniqueSiblingName,
} from "./paths";

export type PasteConflictRequest = {
  sourceName: string;
  destName: string;
  typeMismatch: boolean;
};

export type PasteConflictResolution = "skip" | "replace" | "cancel";

export type PasteResult = {
  succeeded: string[];
  failed: string[];
  cancelled: boolean;
};

type EntryIndex = Map<string, { path: string; isDir: boolean }>;

function buildEntryIndex(entries: FileEntry[]): EntryIndex {
  const index = new Map<string, { path: string; isDir: boolean }>();
  for (const entry of entries) {
    index.set(entry.name, { path: entry.path, isDir: entry.is_dir });
  }
  return index;
}

function sourceIsDir(path: string, entriesByPath: Map<string, FileEntry>): boolean {
  return entriesByPath.get(path)?.is_dir ?? false;
}

export async function performPaste(options: {
  backend: ExplorerBackend;
  clipboard: FileClipboard;
  destDir: string;
  listingEntries: FileEntry[];
  allEntriesByPath: Map<string, FileEntry>;
  batchOnError: PasteBatchOnError;
  askConflict: (request: PasteConflictRequest) => Promise<PasteConflictResolution>;
}): Promise<PasteResult> {
  const {
    backend,
    clipboard,
    destDir,
    listingEntries,
    allEntriesByPath,
    batchOnError,
    askConflict,
  } = options;

  const destIndex = buildEntryIndex(listingEntries);
  const destNames = new Set(destIndex.keys());
  const actionId = clipboard.operation === "cut" ? "file.move" : "file.copy";
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const source of clipboard.paths) {
    if (isDescendantPath(destDir, source)) {
      failed.push(source);
      if (batchOnError === "stop") {
        return { succeeded, failed, cancelled: false };
      }
      continue;
    }

    const sourceName = basename(source);
    const sourceParent = parentExplorerPath(source);
    const sameFolder = sourceParent === destDir;
    let destName = sourceName;
    let existing = destIndex.get(destName);
    const sourceDir = sourceIsDir(source, allEntriesByPath);
    let overwrite = false;

    if (existing) {
      if (sameFolder && clipboard.operation === "copy") {
        destName = uniqueSiblingName(sourceName, destNames);
        existing = undefined;
      } else {
        const typeMismatch = existing.isDir !== sourceDir;
        const resolution = await askConflict({
          sourceName,
          destName,
          typeMismatch,
        });
        if (resolution === "cancel") {
          return { succeeded, failed, cancelled: true };
        }
        if (resolution === "skip") {
          continue;
        }
        if (typeMismatch) {
          continue;
        }
        overwrite = true;
      }
    }

    if (joinExplorerPath(destDir, destName) === source && clipboard.operation === "cut") {
      continue;
    }

    try {
      await backend.runAction({
        actionId,
        paths: [source],
        destDir,
        newName: destName === sourceName ? undefined : destName,
        overwrite,
      });
      succeeded.push(source);
      destNames.add(destName);
      destIndex.set(destName, {
        path: joinExplorerPath(destDir, destName),
        isDir: sourceDir,
      });
    } catch {
      failed.push(source);
      if (batchOnError === "stop") {
        break;
      }
    }
  }

  return { succeeded, failed, cancelled: false };
}
