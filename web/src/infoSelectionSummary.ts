export type EntrySummarySource = {
  is_dir: boolean;
  is_symlink?: boolean;
  size: number;
};

export type SelectionAggregate = {
  totalCount: number;
  fileCount: number;
  folderCount: number;
  symlinkCount: number;
  totalSize: number;
};

export function aggregateSelection(
  paths: readonly string[],
  entryByPath: ReadonlyMap<string, EntrySummarySource>,
): SelectionAggregate {
  let fileCount = 0;
  let folderCount = 0;
  let symlinkCount = 0;
  let totalSize = 0;

  for (const path of paths) {
    const entry = entryByPath.get(path);
    if (entry?.is_dir) {
      folderCount += 1;
    } else {
      fileCount += 1;
      totalSize += entry?.size ?? 0;
    }
    if (entry?.is_symlink) {
      symlinkCount += 1;
    }
  }

  return {
    totalCount: paths.length,
    fileCount,
    folderCount,
    symlinkCount,
    totalSize,
  };
}
