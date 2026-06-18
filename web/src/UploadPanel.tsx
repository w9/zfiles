import { Pause, Play, X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TruncatedTextTooltip } from "@/components/truncated-text-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileIcon } from "./FileIcon";
import { useTranslation } from "./i18n";
import { formatRelativeModified, formatSize } from "./listing-format";
import { useTheme } from "./useTheme";
import {
  unfinishedSessionPercent,
  unfinishedSessionProgressUnknown,
  type UnfinishedSessionView,
} from "./unfinishedUploadSessions";
import {
  formatEtaSeconds,
  uploadPercent,
  uploadProgressVariant,
  type UploadItemStatus,
  type UploadQueueItem,
} from "./upload-queue";
import { mergeUploadPanelRows, uploadHeaderSegments } from "./uploadPanelRows";

export type UnfinishedSessionsPanelProps = {
  sessions: UnfinishedSessionView[];
  readOnly: boolean;
  onResume: (uploadId: string) => void;
  onAbort: (uploadId: string) => void;
};

/** @deprecated Use UnfinishedSessionsPanelProps */
export type CloudMultipartPanelProps = UnfinishedSessionsPanelProps;

type UploadPanelProps = {
  items: UploadQueueItem[];
  onClearFinished: () => void;
  onClearDone: (queueId: string) => void;
  onCancel: (queueId: string) => void;
  onPause: (queueId: string) => void;
  onResume: (queueId: string) => void;
  onClose?: () => void;
  onChooseFiles?: () => void;
  readOnly?: boolean;
  unfinishedSessions?: UnfinishedSessionsPanelProps;
  /** @deprecated Use unfinishedSessions */
  cloudMultipart?: UnfinishedSessionsPanelProps;
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

function queueRowShowsProgress(item: UploadQueueItem): boolean {
  return (
    !isTerminalUploadStatus(item.status) &&
    item.status !== "pending" &&
    item.status !== "awaiting_conflict" &&
    item.total > 0
  );
}

const rowProgressFillClasses: Record<"upload" | "local", string> = {
  upload: "bg-primary/20",
  local: "bg-muted-foreground/25",
};

type RowProgressBackgroundProps = {
  percent: number;
  variant: "upload" | "local";
};

function RowProgressBackground({ percent, variant }: RowProgressBackgroundProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className={cn(
          "h-full transition-[width] duration-150 ease-out",
          rowProgressFillClasses[variant],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
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

  const total = formatSize(item.total, false);
  const percent = String(uploadPercent(item));
  const speed = formatSpeed(item.speedBps);
  const eta = formatEtaSeconds(item.etaSeconds);
  const head = t("upload.statsWithPercent", { status, percent, total });

  if (isTerminalUploadStatus(item.status)) {
    return <span className="truncate">{t("upload.statsBasic", { status, total })}</span>;
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="truncate">{head}</span>
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

function sessionProgressKnownLine(
  session: UnfinishedSessionView,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  const percent = unfinishedSessionPercent(session);
  if (percent == null || session.bytesUploaded == null || session.totalBytes == null) {
    return null;
  }
  return t("upload.multipart.progressKnown", {
    uploaded: formatSize(session.bytesUploaded, false),
    total: formatSize(session.totalBytes, false),
    percent: String(percent),
  });
}

function sessionProgressUnknown(session: UnfinishedSessionView): boolean {
  return unfinishedSessionProgressUnknown(session);
}

type QueueRowProps = {
  item: UploadQueueItem;
  iconTheme: ReturnType<typeof useTheme>["resolved"];
  onClearDone: (queueId: string) => void;
  onCancel: (queueId: string) => void;
  onPause: (queueId: string) => void;
  onResume: (queueId: string) => void;
};

function QueueRow({ item, iconTheme, onClearDone, onCancel, onPause, onResume }: QueueRowProps) {
  const { t } = useTranslation();
  const showProgress = queueRowShowsProgress(item);
  const progressPercent = uploadPercent(item);
  const progressVariant = uploadProgressVariant(item.status);
  const cancellable =
    item.status === "pending" ||
    item.status === "hashing" ||
    item.status === "active" ||
    item.status === "paused" ||
    item.status === "awaiting_conflict";

  return (
    <li
      className={cn(
        item.status === "done" && "opacity-70",
        item.status === "cancelled" && "opacity-70",
      )}
    >
      <div
        className="relative px-4 py-3"
        {...(showProgress
          ? {
              role: "progressbar",
              "aria-valuemin": 0,
              "aria-valuemax": item.total,
              "aria-valuenow": item.offset,
              "aria-label": item.fileName,
            }
          : {})}
      >
        {showProgress ? (
          <RowProgressBackground percent={progressPercent} variant={progressVariant} />
        ) : null}
        <div className="relative flex items-center gap-2">
        <FileIcon name={item.fileName} isDir={false} theme={iconTheme} size="xs" />
        <div className="min-w-0 flex-1">
          <TruncatedTextTooltip
            as="p"
            text={item.fileName}
            className="truncate text-sm font-medium"
          />
          <TruncatedTextTooltip
            as="p"
            text={item.destPath}
            className="truncate text-xs text-muted-foreground"
          />
        </div>
        <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
          <QueueRowStats item={item} />
        </div>
        {item.status === "done" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("upload.clearDone")}
            onClick={() => onClearDone(item.id)}
          >
            <X className="size-4" />
          </Button>
        ) : item.status === "active" ||
          item.status === "paused" ||
          cancellable ? (
          <div className="flex shrink-0 items-center gap-0.5">
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
        ) : null}
        </div>
        {item.status === "failed" && item.error ? (
          <p className="mt-2 text-xs text-destructive">{item.error}</p>
        ) : null}
      </div>
    </li>
  );
}

type SessionRowProps = {
  session: UnfinishedSessionView;
  iconTheme: ReturnType<typeof useTheme>["resolved"];
  readOnly: boolean;
  onResume: (uploadId: string) => void;
  onAbort: (uploadId: string) => void;
};

function SessionRow({ session, iconTheme, readOnly, onResume, onAbort }: SessionRowProps) {
  const { t, locale } = useTranslation();
  const busy = session.resuming || session.aborting;
  const sessionPercent = unfinishedSessionPercent(session);
  const showProgress =
    session.bytesUploaded != null &&
    session.totalBytes != null &&
    session.totalBytes > 0 &&
    sessionPercent != null;
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
    sessionProgressKnownLine(session, t),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <div
        className="relative px-4 py-3"
        {...(showProgress
          ? {
              role: "progressbar",
              "aria-valuemin": 0,
              "aria-valuemax": session.totalBytes ?? undefined,
              "aria-valuenow": session.bytesUploaded ?? undefined,
              "aria-label": session.fileName,
            }
          : {})}
      >
        {showProgress ? (
          <RowProgressBackground percent={sessionPercent} variant="local" />
        ) : null}
        <div className="relative flex items-center gap-2">
        <FileIcon name={session.fileName} isDir={false} theme={iconTheme} size="xs" />
        <div className="min-w-0 flex-1">
          <TruncatedTextTooltip
            as="p"
            text={session.fileName}
            className="truncate text-sm font-medium"
          />
          <TruncatedTextTooltip
            as="p"
            text={session.destPath}
            className="truncate text-xs text-muted-foreground"
          />
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="cursor-help underline decoration-dotted underline-offset-2"
              >
                {session.canResume
                  ? t("upload.status.unfinished")
                  : t("upload.status.startedElsewhere")}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs space-y-2">
              <p>
                {session.canResume
                  ? t("upload.unfinished.description")
                  : t("upload.startedElsewhere.description")}
              </p>
              {session.canResume && sessionProgressUnknown(session) ? (
                <p>{t("upload.multipart.progressUnknown")}</p>
              ) : null}
            </TooltipContent>
          </Tooltip>
          {statsRest ? ` · ${statsRest}` : null}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
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
                className="h-8 w-8 shrink-0"
                disabled={busy}
                aria-label={abortLabel}
                onClick={() => onAbort(session.uploadId)}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{abortLabel}</TooltipContent>
          </Tooltip>
        </div>
        </div>
      </div>
    </li>
  );
}

export default function UploadPanel({
  items,
  onClearFinished,
  onClearDone,
  onCancel,
  onPause,
  onResume,
  onClose,
  onChooseFiles,
  readOnly = false,
  unfinishedSessions,
  cloudMultipart,
  onDragHandlePointerDown,
}: UploadPanelProps) {
  const { t } = useTranslation();
  const { resolved: iconTheme } = useTheme();
  const sessionPanel = unfinishedSessions ?? cloudMultipart;
  const sessions = sessionPanel?.sessions ?? [];
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
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3",
          onDragHandlePointerDown && "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        aria-label={onDragHandlePointerDown ? t("upload.tray.dragHandle") : undefined}
        onPointerDown={onDragHandlePointerDown}
      >
        <TruncatedTextTooltip
          as="h2"
          text={headerTitle}
          className="min-w-0 flex-1 truncate text-sm font-medium"
        />
        <div className="flex shrink-0 items-center gap-1">
          {onChooseFiles ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onChooseFiles}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {t("upload.chooseFiles")}
            </Button>
          ) : null}
          {finishedCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFinished}
              onPointerDown={(event) => event.stopPropagation()}
            >
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
              onPointerDown={(event) => event.stopPropagation()}
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
                  onClearDone={onClearDone}
                  onCancel={onCancel}
                  onPause={onPause}
                  onResume={onResume}
                />
              ) : sessionPanel ? (
                <SessionRow
                  key={row.session.uploadId}
                  session={row.session}
                  iconTheme={iconTheme}
                  readOnly={sessionPanel.readOnly}
                  onResume={sessionPanel.onResume}
                  onAbort={sessionPanel.onAbort}
                />
              ) : null,
            )}
          </ul>
        </ScrollArea>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {readOnly ? t("upload.readOnly") : t("upload.tray.empty")}
        </p>
      )}
    </div>
  );
}
