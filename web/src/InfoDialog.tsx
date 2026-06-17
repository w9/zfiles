import { useMemo, type ReactNode } from "react";

import PreviewPane from "./PreviewPane";
import type { FileEntry } from "./backend";
import { formatSize } from "./listing-format";
import { aggregateSelection } from "./infoSelectionSummary";
import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { basename } from "@/fileOperations/paths";

type InfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paths: string[];
  entries: FileEntry[];
  onSymlinkTargetClick?: (resolvedPath: string) => void;
};

function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function InfoAggregateSummary({
  paths,
  entries,
}: {
  paths: string[];
  entries: FileEntry[];
}) {
  const { t } = useTranslation();
  const entryByPath = useMemo(
    () => new Map(entries.map((entry) => [entry.path, entry])),
    [entries],
  );
  const summary = useMemo(
    () => aggregateSelection(paths, entryByPath),
    [paths, entryByPath],
  );

  return (
    <dl className="grid gap-2 text-sm">
      <MetadataRow label={t("preview.aggregate.items")}>
        {t("preview.aggregate.summary", { count: String(summary.totalCount) })}
      </MetadataRow>
      <MetadataRow label={t("preview.type")}>
        {t("preview.aggregate.breakdown", {
          files: String(summary.fileCount),
          folders: String(summary.folderCount),
        })}
      </MetadataRow>
      {summary.symlinkCount > 0 ? (
        <MetadataRow label={t("preview.type.symlink")}>
          {t("preview.aggregate.symlinks", { count: String(summary.symlinkCount) })}
        </MetadataRow>
      ) : null}
      <MetadataRow label={t("preview.size")}>
        {formatSize(summary.totalSize, false)}
      </MetadataRow>
    </dl>
  );
}

export default function InfoDialog({
  open,
  onOpenChange,
  paths,
  entries,
  onSymlinkTargetClick,
}: InfoDialogProps) {
  const { t } = useTranslation();
  const singlePath = paths.length === 1 ? paths[0]! : null;
  const title =
    singlePath != null
      ? basename(singlePath)
      : t("preview.getInfo.titleMultiple", { count: String(paths.length) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-auto">
          {singlePath != null ? (
            <PreviewPane
              path={singlePath}
              showTitle={false}
              onSymlinkTargetClick={onSymlinkTargetClick}
              className="min-h-0 rounded-none border-0 bg-transparent p-0 shadow-none"
            />
          ) : (
            <InfoAggregateSummary paths={paths} entries={entries} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
