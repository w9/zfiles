import { useEffect, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTranslation } from "./i18n";
import { formatSize } from "./listing-format";
import UploadFloatingPanel from "./UploadFloatingPanel";
import UploadPanel, { type CloudMultipartPanelProps } from "./UploadPanel";
import { formatEtaSeconds, type UploadQueueItem } from "./upload-queue";
import { isUploadTraySheetLayout } from "./uploadTrayGeometry";
import {
  aggregateUploadStats,
  initialTrayAutoOpenState,
  reduceTrayAutoOpen,
  uploadTrayAttention,
} from "./uploadTray";

type UploadIndicatorProps = {
  items: UploadQueueItem[];
  onClearFinished: () => void;
  onCancel: (queueId: string) => void;
  onPause: (queueId: string) => void;
  onResume: (queueId: string) => void;
  cloudMultipart?: CloudMultipartPanelProps;
};

function formatSpeed(bps: number | null): string | null {
  if (bps == null || bps <= 0) {
    return null;
  }
  return `${formatSize(Math.round(bps), false)}/s`;
}

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

export default function UploadIndicator({
  items,
  onClearFinished,
  onCancel,
  onPause,
  onResume,
  cloudMultipart,
}: UploadIndicatorProps) {
  const { t } = useTranslation();
  const stats = useMemo(() => aggregateUploadStats(items), [items]);
  const attention = uploadTrayAttention(stats);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetLayout = useUploadTraySheetLayout();

  // Auto-open the tray once each time a fresh batch of work begins; it
  // re-arms only after the queue fully drains (see reduceTrayAutoOpen).
  const autoOpenRef = useRef(initialTrayAutoOpenState);
  const hasPendingWork = stats.hasPendingWork;
  useEffect(() => {
    const result = reduceTrayAutoOpen(autoOpenRef.current, { hasPendingWork });
    autoOpenRef.current = result.state;
    if (result.open) {
      setOpen(true);
    }
  }, [hasPendingWork]);

  let label: string | null = null;
  if (stats.hasInFlight) {
    const parts = [t("upload.tray.uploading", { count: String(stats.inFlight) })];
    if (stats.percent != null) {
      parts.push(`${stats.percent}%`);
    }
    const speed = formatSpeed(stats.speedBps);
    if (speed) {
      parts.push(speed);
    }
    const eta = formatEtaSeconds(stats.etaSeconds);
    if (eta) {
      parts.push(`~${eta}`);
    }
    label = parts.join(" · ");
  } else if (stats.userPaused > 0) {
    label = t("upload.tray.paused", { count: String(stats.userPaused) });
  } else if (stats.awaitingConflict > 0) {
    label = t("upload.tray.awaitingConflict", { count: String(stats.awaitingConflict) });
  } else if (stats.pending > 0) {
    label = t("upload.tray.queued", { count: String(stats.pending) });
  } else if (stats.failed > 0) {
    label = t("upload.tray.failed", { count: String(stats.failed) });
  } else if (stats.finished > 0) {
    label = t("upload.tray.recent", { count: String(stats.finished) });
  }

  const closePanel = () => setOpen(false);
  const panel = (
    <UploadPanel
      items={items}
      onClearFinished={onClearFinished}
      onCancel={onCancel}
      onPause={onPause}
      onResume={onResume}
      onClose={closePanel}
      cloudMultipart={cloudMultipart}
    />
  );

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 shrink-0 gap-1.5 px-2 text-xs font-medium",
          stats.hasInFlight && "text-foreground",
        )}
        aria-label={t("upload.tray.label")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative flex items-center">
          <Upload className="size-4" />
          {attention ? (
            <span
              className={cn(
                "absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-card",
                stats.failed > 0 ? "bg-destructive" : "bg-amber-500",
              )}
              aria-hidden
            />
          ) : null}
        </span>
        {label ? <span className="tabular-nums">{label}</span> : null}
      </Button>

      {sheetLayout ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="flex h-[min(70vh,40rem)] flex-col gap-0 overflow-hidden p-0"
            onInteractOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            {panel}
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
              items={items}
              onClearFinished={onClearFinished}
              onCancel={onCancel}
              onPause={onPause}
              onResume={onResume}
              onClose={closePanel}
              cloudMultipart={cloudMultipart}
              onDragHandlePointerDown={onDragHandlePointerDown}
            />
          )}
        </UploadFloatingPanel>
      )}
    </>
  );
}
