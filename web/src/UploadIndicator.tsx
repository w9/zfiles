import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from "./i18n";
import UploadFloatingPanel from "./UploadFloatingPanel";
import UploadPanel, { type CloudMultipartPanelProps } from "./UploadPanel";
import { pickUploadFiles } from "./pickUploadFiles";
import type { DroppedUploadFile } from "./useGlobalFileDrop";
import { isUploadTraySheetLayout } from "./uploadTrayGeometry";
import {
  aggregateUploadStats,
  initialTrayAutoOpenState,
  reduceTrayAutoOpen,
  uploadTrayAttention,
} from "./uploadTray";
import type { UploadQueueItem } from "./upload-queue";

type UploadIndicatorProps = {
  items: UploadQueueItem[];
  onSelect: (dropped: DroppedUploadFile[]) => void;
  onClearFinished: () => void;
  onClearDone: (queueId: string) => void;
  onCancel: (queueId: string) => void;
  onPause: (queueId: string) => void;
  onResume: (queueId: string) => void;
  readOnly?: boolean;
  unfinishedSessions?: CloudMultipartPanelProps;
  /** @deprecated Use unfinishedSessions */
  cloudMultipart?: CloudMultipartPanelProps;
  onTrayClick?: () => void;
};

export type UploadIndicatorHandle = {
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  chooseFiles: () => void;
};

function useUploadTraySheetLayout(): boolean {
  const [sheetLayout, setSheetLayout] = useState(() =>
    typeof window === "undefined" ? false : isUploadTraySheetLayout(),
  );

  useEffect(() => {
    const onResize = () => setSheetLayout(isUploadTraySheetLayout());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return sheetLayout;
}

export default forwardRef<UploadIndicatorHandle, UploadIndicatorProps>(
  function UploadIndicator(
    {
      items,
      onSelect,
      onClearFinished,
      onClearDone,
      onCancel,
      onPause,
      onResume,
      readOnly = false,
      unfinishedSessions,
      cloudMultipart,
      onTrayClick,
    },
    ref,
  ) {
  const sessionPanel = unfinishedSessions ?? cloudMultipart;
  const { t } = useTranslation();
  const stats = useMemo(() => aggregateUploadStats(items), [items]);
  const attention = uploadTrayAttention(stats);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const sheetLayout = useUploadTraySheetLayout();

  const autoOpenRef = useRef(initialTrayAutoOpenState);
  const hasPendingWork = stats.hasPendingWork;
  useEffect(() => {
    const result = reduceTrayAutoOpen(autoOpenRef.current, { hasPendingWork });
    autoOpenRef.current = result.state;
    if (result.open) {
      setOpen(true);
    }
  }, [hasPendingWork]);

  const openFilePicker = () => {
    pickUploadFiles((files) => {
      if (files.length > 0) {
        onSelectRef.current(
          files.map((file) => ({ file, sourceHandle: null })),
        );
      }
    });
  };
  const closePanel = () => setOpen(false);
  useImperativeHandle(
    ref,
    () => ({
      openPanel: () => setOpen(true),
      closePanel,
      togglePanel: () => setOpen((value) => !value),
      chooseFiles: openFilePicker,
    }),
    [],
  );
  const panelProps = {
    items,
    onClearFinished,
    onClearDone,
    onCancel,
    onPause,
    onResume,
    onClose: closePanel,
    readOnly,
    unfinishedSessions: sessionPanel,
    cloudMultipart: sessionPanel,
    onChooseFiles: readOnly ? undefined : openFilePicker,
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "relative h-8 w-8 touch-ui:h-11 touch-ui:w-11",
              open && "bg-accent text-accent-foreground",
            )}
            aria-label={t("upload.tray.label")}
            aria-expanded={open}
            aria-pressed={open}
            onClick={() => {
              if (onTrayClick) {
                onTrayClick();
                return;
              }
              setOpen((value) => !value);
            }}
          >
            <Upload className="h-4 w-4" />
            {attention ? (
              <span
                className={cn(
                  "absolute top-0.5 right-0.5 size-2 rounded-full ring-2 ring-background",
                  stats.failed > 0 ? "bg-destructive" : "bg-amber-500",
                )}
                aria-hidden
              />
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("upload.tray.label")}</TooltipContent>
      </Tooltip>

      {sheetLayout ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="flex h-[min(70vh,40rem)] flex-col gap-0 overflow-hidden p-0"
            onInteractOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <UploadPanel {...panelProps} />
          </SheetContent>
        </Sheet>
      ) : (
        <UploadFloatingPanel
          open={open}
          anchorRef={triggerRef}
          onClose={closePanel}
        >
          {({ onDragHandlePointerDown }) => (
            <UploadPanel
              {...panelProps}
              onDragHandlePointerDown={onDragHandlePointerDown}
            />
          )}
        </UploadFloatingPanel>
      )}
    </>
  );
  },
);
