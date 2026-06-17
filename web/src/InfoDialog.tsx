import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";

import PreviewPane from "./PreviewPane";
import MetadataValueRow from "./MetadataValueRow";
import type { FileEntry } from "./backend";
import { formatSize } from "./listing-format";
import { aggregateSelection } from "./infoSelectionSummary";
import { formatInfoAggregateBreakdown } from "./selectionStatusText";
import FloatingPanel, { resolveStoredOrDefaultGeometry } from "./FloatingPanel";
import {
  INFO_PANEL_GEOMETRY_STORAGE_KEY,
  INFO_PANEL_HEIGHT_PX,
  INFO_PANEL_SIZE_LIMITS,
  INFO_PANEL_WIDTH_PX,
} from "./infoPanelGeometry";
import {
  centerPanelGeometry,
  isFloatingPanelSheetLayout,
  type ViewportSize,
} from "./floatingPanelGeometry";
import { useTranslation, type MessageKey } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { basename } from "@/fileOperations/paths";

type InfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paths: string[];
  entries: FileEntry[];
  onSymlinkTargetClick?: (resolvedPath: string) => void;
};

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
  const selectionLabel = t("preview.aggregate.summary", { count: String(summary.totalCount) });
  const breakdownLabel = formatInfoAggregateBreakdown(
    summary.fileCount,
    summary.folderCount,
    (key, params) => t(key as MessageKey, params),
  );
  const symlinksLabel =
    summary.symlinkCount > 0
      ? t("preview.aggregate.symlinks", { count: String(summary.symlinkCount) })
      : null;
  const sizeLabel = formatSize(summary.totalSize, false);

  return (
    <dl className="grid gap-2 text-sm">
      <MetadataValueRow rowKey="selection" label={t("preview.aggregate.items")} copyText={selectionLabel}>
        {selectionLabel}
      </MetadataValueRow>
      <MetadataValueRow rowKey="type" label={t("preview.type")} copyText={breakdownLabel}>
        {breakdownLabel}
      </MetadataValueRow>
      {symlinksLabel != null ? (
        <MetadataValueRow rowKey="symlinks" label={t("preview.type.symlink")} copyText={symlinksLabel}>
          {symlinksLabel}
        </MetadataValueRow>
      ) : null}
      <MetadataValueRow rowKey="size" label={t("preview.size")} copyText={sizeLabel}>
        {sizeLabel}
      </MetadataValueRow>
    </dl>
  );
}

function resolveInfoPanelGeometry(viewport: ViewportSize) {
  return resolveStoredOrDefaultGeometry(
    INFO_PANEL_GEOMETRY_STORAGE_KEY,
    viewport,
    INFO_PANEL_SIZE_LIMITS,
    centerPanelGeometry(INFO_PANEL_WIDTH_PX, INFO_PANEL_HEIGHT_PX, viewport, INFO_PANEL_SIZE_LIMITS),
  );
}

type InfoPanelChromeProps = {
  title: string;
  onClose: () => void;
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  children: ReactNode;
};

function InfoPanelChrome({
  title,
  onClose,
  onDragHandlePointerDown,
  children,
}: InfoPanelChromeProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 w-full flex-col" aria-label={t("preview.label")}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3",
          onDragHandlePointerDown &&
            "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        aria-label={onDragHandlePointerDown ? t("preview.getInfo.dragHandle") : undefined}
        onPointerDown={onDragHandlePointerDown}
      >
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t("preview.getInfo.close")}
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
    </div>
  );
}

function useInfoSheetLayout(): boolean {
  const [sheetLayout, setSheetLayout] = useState(() =>
    typeof window === "undefined" ? false : isFloatingPanelSheetLayout(),
  );

  useEffect(() => {
    const onResize = () => setSheetLayout(isFloatingPanelSheetLayout());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return sheetLayout;
}

export default function InfoDialog({
  open,
  onOpenChange,
  paths,
  entries,
  onSymlinkTargetClick,
}: InfoDialogProps) {
  const { t } = useTranslation();
  const sheetLayout = useInfoSheetLayout();
  const singlePath = paths.length === 1 ? paths[0]! : null;
  const title =
    paths.length === 0
      ? t("preview.getInfo.sheetLabel")
      : singlePath != null
        ? t("preview.getInfo.titleSingle", { name: basename(singlePath) })
        : t("preview.getInfo.titleMultiple", { count: String(paths.length) });

  const body =
    paths.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t("preview.selectFile")}</p>
    ) : singlePath != null ? (
      <PreviewPane
        path={singlePath}
        showTitle={false}
        onSymlinkTargetClick={onSymlinkTargetClick}
        className="min-h-0 rounded-none border-0 bg-transparent p-0 shadow-none"
      />
    ) : (
      <InfoAggregateSummary paths={paths} entries={entries} />
    );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const resolveInitialGeometry = useCallback(
    (viewport: ViewportSize) => resolveInfoPanelGeometry(viewport),
    [],
  );

  if (!open) {
    return null;
  }

  if (sheetLayout) {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            onOpenChange(true);
          }
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex h-[min(70vh,40rem)] flex-col gap-0 overflow-hidden p-0"
          aria-label={t("preview.getInfo.sheetLabel")}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <InfoPanelChrome title={title} onClose={close}>
            {body}
          </InfoPanelChrome>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <FloatingPanel
      open={open}
      onClose={close}
      ariaLabel={t("preview.label")}
      storageKey={INFO_PANEL_GEOMETRY_STORAGE_KEY}
      resizable
      sizeLimits={INFO_PANEL_SIZE_LIMITS}
      resolveInitialGeometry={resolveInitialGeometry}
    >
      {({ onDragHandlePointerDown }) => (
        <InfoPanelChrome
          title={title}
          onClose={close}
          onDragHandlePointerDown={onDragHandlePointerDown}
        >
          {body}
        </InfoPanelChrome>
      )}
    </FloatingPanel>
  );
}
