import { Pause, Play, Trash2, X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileIcon } from "./FileIcon";
import { multipartPercent } from "./cloud/s3Multipart";
import type { MultipartSessionView } from "./cloud/useMultipartSessions";
import { useTranslation } from "./i18n";
import { formatRelativeModified, formatSize } from "./listing-format";
import { useTheme } from "./useTheme";
import {
  formatEtaSeconds,
  uploadPercent,
  uploadProgressVariant,
  type UploadItemStatus,
  type UploadQueueItem,
} from "./upload-queue";
import { mergeUploadPanelRows, uploadHeaderSegments } from "./uploadPanelRows";

export type CloudMultipartPanelProps = {
  sessions: MultipartSessionView[];
  readOnly: boolean;
  onResume: (uploadId: string) => void;
  onAbort: (uploadId: string) => void;
};

type UploadPanelProps = {
  items: UploadQueueItem[];
  onClearFinished: () => void;
  onCancel: (queueId: string) => void;
  onPause: (queueId: string) => void;
  onResume: (queueId: string) => void;
  onClose?: () => void;
  cloudMultipart?: CloudMultipartPanelProps;
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
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
    case "hashing":
      return t("upload.status.hashing");
    case "active":
      return t("upload.status.active");
    case "verifying":
      return t("upload.status.verifying");
    case "paused":
      return t("upload.status.paused");
    case "done":
      return t("upload.status.done");
    case "failed":
      return t("upload.status.failed");
    case "cancelled":
      return t("upload.status.cancelled");
  }
}

function isTerminalUploadStatus(status: UploadItemStatus): boolean {
  return status === "done" || status === "failed" || status === "cancelled";
}

type QueueRowStatsProps = {
  item: UploadQueueItem;
};

function QueueRowStats({ item }: QueueRowStatsProps) {
  const { t } = useTranslation();
  const status = statusLabel(item.status, t);

  if (item.status === "pending" || item.status === "awaiting_conflict") {
    return (
      <span className="truncate">
        {t("upload.statsQueued", {
          status,
          size: formatSize(item.total, false),
        })}
      </span>
    );
  }

  const uploaded = formatSize(item.offset, false);
  const total = formatSize(item.total, false);
  const percent = String(uploadPercent(item));
  const speed = formatSpeed(item.speedBps);
  const eta = formatEtaSeconds(item.etaSeconds);
  const head = t("upload.statsBasic", { status, total });

  if (isTerminalUploadStatus(item.status)) {
    return <span className="truncate">{head}</span>;
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="truncate">{head}</span>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">
            <Progress
              value={item.offset}
              max={item.total || 1}
              variant={uploadProgressVariant(item.status)}
              className="h-1.5 w-[6em]"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("upload.stats.progressTooltip", { percent, uploaded, total })}
        </TooltipContent>
      </Tooltip>
      {speed ? <span className="shrink-0">{t("upload.statsSpeed", { speed })}</span> : null}
      {speed && eta ? <span className="shrink-0">{t("upload.statsFull", { eta })}</span> : null}
    </span>
  );
}

function panelHeaderTitle(
  items: UploadQueueItem[],
  sessionCount: number,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const segments = uploadHeaderSegments(items, sessionCount).map((segment) =>
    t(segment.key, { count: String(segment.count) }),
  );
  return t("upload.queue.titleWithStatus", {
    count: String(items.length + sessionCount),
    statusSummary: segments.join(" · "),
  });
}

function multipartProgressLine(
  session: MultipartSessionView,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const percent = multipartPercent(session);
  if (percent == null || session.bytesUploaded == null || session.totalBytes == null) {
    return t("upload.multipart.progressUnknown");
  }
  return t("upload.multipart.progressKnown", {
    uploaded: formatSize(session.bytesUploaded, false),
    total: formatSize(session.totalBytes, false),
    percent: String(percent),
  });
}

type QueueRowProps = {
  item: UploadQueueItem;
  iconTheme: ReturnType<typeof useTheme>["resolved"];
  onCancel: (queueId: string) => void;
  onPause: (queueId: string) => void;
  onResume: (queueId: string) => void;
};

function QueueRow({ item, iconTheme, onCancel, onPause, onResume }: QueueRowProps) {
  const { t } = useTranslation();
  const isActive =
    item.status === "active" ||
    item.status === "hashing" ||
    item.status === "verifying";
  const isPaused = item.status === "paused";
  const cancellable =
    item.status === "pending" ||
    item.status === "hashing" ||
    item.status === "active" ||
    item.status === "paused" ||
    item.status === "awaiting_conflict";

  return (
    <li
      className={cn(
        "space-y-2 px-4 py-3",
        isActive && "bg-muted/40",
        isPaused && "bg-muted/20",
        item.status === "done" && "opacity-70",
        item.status === "cancelled" && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2">
        <FileIcon name={item.fileName} isDir={false} theme={iconTheme} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={item.destPath}>
            {item.destPath}
          </p>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
          <QueueRowStats item={item} />
        </div>
        {item.status === "active" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("upload.pause")}
            onClick={() => onPause(item.id)}
          >
            <Pause className="size-4" />
          </Button>
        ) : null}
        {item.status === "paused" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("upload.resume")}
            onClick={() => onResume(item.id)}
          >
            <Play className="size-4" />
          </Button>
        ) : null}
        {cancellable ? (
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
    </li>
  );
}

type SessionRowProps = {
  session: MultipartSessionView;
  iconTheme: ReturnType<typeof useTheme>["resolved"];
  readOnly: boolean;
  onResume: (uploadId: string) => void;
  onAbort: (uploadId: string) => void;
};

function SessionRow({ session, iconTheme, readOnly, onResume, onAbort }: SessionRowProps) {
  const { t, locale } = useTranslation();
  const busy = session.resuming || session.aborting;
  const startedAt =
    session.initiated != null
      ? formatRelativeModified(session.initiated.getTime(), locale)
      : null;
  const resumeLabel = session.resuming
    ? t("upload.multipart.resuming")
    : t("upload.multipart.resume");
  const abortLabel = session.aborting
    ? t("upload.multipart.aborting")
    : t("upload.multipart.abort");
  const statsRest = [
    startedAt ? t("upload.multipart.startedAt", { time: startedAt }) : null,
    multipartProgressLine(session, t),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <FileIcon name={session.fileName} isDir={false} theme={iconTheme} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={session.fileName}>
            {session.fileName}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={session.destPath}>
            {session.destPath}
          </p>
        </div>
        <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {!session.canResume ? (
            <Badge
              variant="secondary"
              className="shrink-0 font-normal"
              title={t("upload.multipart.remoteOnly")}
            >
              {t("upload.multipart.remote")}
            </Badge>
          ) : null}
          <span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="cursor-help underline decoration-dotted underline-offset-2"
                >
                  {t("upload.status.unfinished")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {t("upload.multipart.description")}
              </TooltipContent>
            </Tooltip>
            {` · ${statsRest}`}
          </span>
        </p>
        {session.canResume && !readOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={busy}
                aria-label={resumeLabel}
                onClick={() => onResume(session.uploadId)}
              >
                <Play className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{resumeLabel}</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={busy}
              aria-label={abortLabel}
              onClick={() => onAbort(session.uploadId)}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{abortLabel}</TooltipContent>
        </Tooltip>
      </div>
      {session.bytesUploaded != null && session.totalBytes != null ? (
        <Progress
          value={session.bytesUploaded}
          max={session.totalBytes || 1}
          variant="local"
        />
      ) : null}
    </li>
  );
}

export default function UploadPanel({
  items,
  onClearFinished,
  onCancel,
  onPause,
  onResume,
  onClose,
  cloudMultipart,
  onDragHandlePointerDown,
}: UploadPanelProps) {
  const { t } = useTranslation();
  const { resolved: iconTheme } = useTheme();
  const sessions = cloudMultipart?.sessions ?? [];
  const rows = mergeUploadPanelRows(items, sessions);
  const finishedCount = items.filter(
    (item) =>
      item.status === "done" ||
      item.status === "failed" ||
      item.status === "cancelled",
  ).length;

  const headerTitle =
    rows.length > 0
      ? panelHeaderTitle(items, sessions.length, t)
      : t("upload.tray.title");

  return (
    <div className="flex h-full min-h-0 w-full flex-col" aria-label={headerTitle}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <h2
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-medium",
            onDragHandlePointerDown && "cursor-grab touch-none select-none active:cursor-grabbing",
          )}
          title={headerTitle}
          aria-label={onDragHandlePointerDown ? t("upload.tray.dragHandle") : undefined}
          onPointerDown={onDragHandlePointerDown}
        >
          {headerTitle}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {finishedCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClearFinished}>
              {t("upload.clearFinished")}
            </Button>
          ) : null}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("upload.tray.close")}
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      {rows.length > 0 ? (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="divide-y">
            {rows.map((row) =>
              row.kind === "queue" ? (
                <QueueRow
                  key={row.item.id}
                  item={row.item}
                  iconTheme={iconTheme}
                  onCancel={onCancel}
                  onPause={onPause}
                  onResume={onResume}
                />
              ) : cloudMultipart ? (
                <SessionRow
                  key={row.session.uploadId}
                  session={row.session}
                  iconTheme={iconTheme}
                  readOnly={cloudMultipart.readOnly}
                  onResume={cloudMultipart.onResume}
                  onAbort={cloudMultipart.onAbort}
                />
              ) : null,
            )}
          </ul>
        </ScrollArea>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {t("upload.tray.empty")}
        </p>
      )}
    </div>
  );
}
