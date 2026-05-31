import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTranslation } from "./i18n";
import type { MessageKey } from "./i18n/messages";
import { formatSize } from "./listing-format";
import {
  countUploadsByStatus,
  formatEtaSeconds,
  UPLOAD_QUEUE_HEADER_STATUS_ORDER,
  uploadPercent,
  type UploadItemStatus,
  type UploadQueueItem,
} from "./upload-queue";

type UploadPanelProps = {
  items: UploadQueueItem[];
  onClearFinished: () => void;
  onCancel: (queueId: string) => void;
};

function formatSpeed(bps: number | null): string | null {
  if (bps == null || bps <= 0) {
    return null;
  }
  return `${formatSize(Math.round(bps), false)}/s`;
}

function statusLabel(
  status: UploadItemStatus,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (status) {
    case "pending":
      return t("upload.status.pending");
    case "awaiting_conflict":
      return t("upload.status.awaitingConflict");
    case "active":
      return t("upload.status.active");
    case "done":
      return t("upload.status.done");
    case "failed":
      return t("upload.status.failed");
    case "cancelled":
      return t("upload.status.cancelled");
  }
}

function statsLine(item: UploadQueueItem, t: ReturnType<typeof useTranslation>["t"]): string {
  const status = statusLabel(item.status, t);

  if (item.status === "pending" || item.status === "awaiting_conflict") {
    return t("upload.statsQueued", {
      status,
      size: formatSize(item.total, false),
    });
  }

  const uploaded = formatSize(item.offset, false);
  const total = formatSize(item.total, false);
  const percent = String(uploadPercent(item));
  const speed = formatSpeed(item.speedBps);
  const eta = formatEtaSeconds(item.etaSeconds);
  const params = { status, uploaded, total, percent, speed: speed ?? "", eta: eta ?? "" };

  if (speed && eta) {
    return t("upload.statsFull", params);
  }
  if (speed) {
    return t("upload.statsSpeed", params);
  }
  return t("upload.statsBasic", params);
}

const HEADER_STATUS_KEYS: Record<UploadItemStatus, MessageKey> = {
  pending: "upload.queue.header.pending",
  active: "upload.queue.header.active",
  awaiting_conflict: "upload.queue.header.awaitingConflict",
  done: "upload.queue.header.done",
  failed: "upload.queue.header.failed",
  cancelled: "upload.queue.header.cancelled",
};

function queueHeaderTitle(
  items: UploadQueueItem[],
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const counts = countUploadsByStatus(items);
  const segments = UPLOAD_QUEUE_HEADER_STATUS_ORDER.flatMap((status) => {
    const count = counts[status];
    if (!count) {
      return [];
    }
    return [t(HEADER_STATUS_KEYS[status], { count: String(count) })];
  });
  return t("upload.queue.titleWithStatus", {
    count: String(items.length),
    statusSummary: segments.join(" · "),
  });
}

export default function UploadPanel({ items, onClearFinished, onCancel }: UploadPanelProps) {
  const { t } = useTranslation();
  const finishedCount = items.filter(
    (item) =>
      item.status === "done" ||
      item.status === "failed" ||
      item.status === "cancelled",
  ).length;

  if (items.length === 0) {
    return null;
  }

  const headerTitle = queueHeaderTitle(items, t);

  return (
    <section
      className="mt-4 rounded-xl border bg-card"
      aria-label={headerTitle}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-medium">{headerTitle}</h2>
        {finishedCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFinished}>
            {t("upload.clearFinished")}
          </Button>
        ) : null}
      </div>
      <ul className="max-h-64 divide-y overflow-y-auto">
        {items.map((item) => {
          const isActive = item.status === "active";
          return (
            <li
              key={item.id}
              className={cn(
                "space-y-2 px-4 py-3",
                isActive && "bg-muted/40",
                item.status === "done" && "opacity-70",
                item.status === "cancelled" && "opacity-70",
              )}
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium" title={item.fileName}>
                  {item.fileName}
                </p>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {statsLine(item, t)}
                </p>
                {item.status === "pending" ||
                item.status === "active" ||
                item.status === "awaiting_conflict" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={t("upload.cancel")}
                    onClick={() => onCancel(item.id)}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
              {item.status === "failed" && item.error ? (
                <p className="text-xs text-destructive">{item.error}</p>
              ) : null}
              {item.status !== "pending" && item.status !== "awaiting_conflict" ? (
                <Progress value={item.offset} max={item.total || 1} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
