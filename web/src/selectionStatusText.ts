import { aggregateSelection, type EntrySummarySource } from "./infoSelectionSummary";

export type FileFolderCounts = {
  fileCount: number;
  folderCount: number;
};

export type StatusTextTranslate = (
  key: string,
  params?: Record<string, string>,
) => string;

export function countSelectedFileFolders(
  paths: readonly string[],
  entryByPath: ReadonlyMap<string, EntrySummarySource>,
): FileFolderCounts {
  const summary = aggregateSelection(paths, entryByPath);
  return {
    fileCount: summary.fileCount,
    folderCount: summary.folderCount,
  };
}

export function formatFileUnit(count: number, t: StatusTextTranslate): string {
  return count === 1
    ? t("selection.fileUnit.one")
    : t("selection.fileUnit.many", { count: String(count) });
}

export function formatFolderUnit(count: number, t: StatusTextTranslate): string {
  return count === 1
    ? t("selection.folderUnit.one")
    : t("selection.folderUnit.many", { count: String(count) });
}

export function formatBreakdownLabel(
  fileCount: number,
  folderCount: number,
  templateKey: string,
  t: StatusTextTranslate,
): string {
  return t(templateKey, {
    files: formatFileUnit(fileCount, t),
    folders: formatFolderUnit(folderCount, t),
  });
}

export function formatSelectionStatusLabel(
  counts: FileFolderCounts,
  t: StatusTextTranslate,
): string | null {
  const { fileCount, folderCount } = counts;
  const total = fileCount + folderCount;
  if (total === 0) {
    return null;
  }

  if (total === 1) {
    return fileCount === 1
      ? t("selection.fileSelected")
      : t("selection.folderSelected");
  }

  if (fileCount > 0 && folderCount > 0) {
    return formatBreakdownLabel(
      fileCount,
      folderCount,
      "selection.breakdownSelected",
      t,
    );
  }

  if (fileCount > 0) {
    return t("selection.filesSelected", { count: String(fileCount) });
  }

  return t("selection.foldersSelected", { count: String(folderCount) });
}

export function formatCutStatusLabel(
  counts: FileFolderCounts,
  singleItemName: string | null,
  t: StatusTextTranslate,
): string | null {
  const { fileCount, folderCount } = counts;
  const total = fileCount + folderCount;
  if (total === 0) {
    return null;
  }

  if (total === 1 && singleItemName) {
    return t("clipboard.cutOne", { name: singleItemName });
  }

  if (fileCount > 0 && folderCount > 0) {
    return formatBreakdownLabel(fileCount, folderCount, "clipboard.cutBreakdown", t);
  }

  if (fileCount > 0) {
    return t("clipboard.cutManyFiles", { count: String(fileCount) });
  }

  return t("clipboard.cutManyFolders", { count: String(folderCount) });
}

export function formatInfoAggregateBreakdown(
  fileCount: number,
  folderCount: number,
  t: StatusTextTranslate,
): string {
  return formatBreakdownLabel(fileCount, folderCount, "preview.aggregate.breakdown", t);
}
