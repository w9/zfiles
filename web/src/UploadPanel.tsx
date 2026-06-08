import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { MultipartSessionView } from "./cloud/useMultipartSessions";
import { useTranslation } from "./i18n";
import type { MessageKey } from "./i18n/messages";
import { formatSize } from "./listing-format";
import {
  countUploadsByStatus,
  formatEtaSeconds,
  UPLOAD_QUEUE_HEADER_STATUS_ORDER,
  uploadPercent,
  uploadProgressVariant,
  type UploadItemStatus,
  type UploadQueueItem,
} from "./upload-queue";

type CloudMultipartPanelProps = {
  sessions: MultipartSessionView[];
  loading: boolean;
  error: string | null;
  readOnly: boolean;
  onResume: (uploadId: string) => void;
  onAbort: (uploadId: string) => void;
};

type UploadPanelProps = {
  items: UploadQueueItem[];
  onClearFinished: () => void;
  onCancel: (queueId: string) => void;
  cloudMultipart?: CloudMultipartPanelProps;
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
  hashing: "upload.queue.header.hashing",
  active: "upload.queue.header.active",
  verifying: "upload.queue.header.verifying",
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

function multipartProgressLine(
  session: MultipartSessionView,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (session.bytesUploaded == null || session.totalBytes == null || session.totalBytes <= 0) {
    return t("upload.multipart.progressUnknown");
  }
  const percent = String(
    Math.min(100, Math.round((session.bytesUploaded / session.totalBytes) * 100)),
  );
  return t("upload.multipart.progressKnown", {
    uploaded: formatSize(session.bytesUploaded, false),
    total: formatSize(session.totalBytes, false),
    percent,
  });
}

function MultipartSessionsSection({
  sessions,
  loading,
  error,
  readOnly,
  onResume,
  onAbort,
}: CloudMultipartPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="border-t">
      <div className="px-4 py-3">
        <h3 className="text-sm font-medium">{t("upload.multipart.title")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("upload.multipart.description")}</p>
      </div>
      {loading ? (
        <p className="px-4 pb-3 text-xs text-muted-foreground">{t("upload.multipart.loading")}</p>
      ) : null}
      {error ? (
        <p className="px-4 pb-3 text-xs text-destructive">{error}</p>
      ) : null}
      {!loading && !error && sessions.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-muted-foreground">{t("upload.multipart.empty")}</p>
      ) : null}
      {sessions.length > 0 ? (
        <ul className="max-h-48 divide-y overflow-y-auto border-t">
          {sessions.map((session) => (
            <li key={session.uploadId} className="space-y-2 px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={session.fileName}>
                    {session.fileName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={session.destPath}>
                    {session.destPath}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {multipartProgressLine(session, t)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!session.canResume ? (
                  <span className="text-xs text-muted-foreground">
                    {t("upload.multipart.remoteOnly")}
                  </span>
                ) : null}
                {session.canResume && !readOnly ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={session.resuming || session.aborting}
                    onClick={() => onResume(session.uploadId)}
                  >
                    {session.resuming
                      ? t("upload.multipart.resuming")
                      : t("upload.multipart.resume")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={session.resuming || session.aborting}
                  onClick={() => onAbort(session.uploadId)}
                >
                  {session.aborting
                    ? t("upload.multipart.aborting")
                    : t("upload.multipart.abort")}
                </Button>
              </div>
              {session.bytesUploaded != null && session.totalBytes != null ? (
                <Progress value={session.bytesUploaded} max={session.totalBytes || 1} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function UploadPanel({
  items,
  onClearFinished,
  onCancel,
  cloudMultipart,
}: UploadPanelProps) {
  const { t } = useTranslation();
  const finishedCount = items.filter(
    (item) =>
      item.status === "done" ||
      item.status === "failed" ||
      item.status === "cancelled",
  ).length;

  if (items.length === 0 && !cloudMultipart) {
    return null;
  }

  const headerTitle =
    items.length > 0 ? queueHeaderTitle(items, t) : t("upload.multipart.panelTitle");

  return (
    <section
      className="mt-4 rounded-xl border bg-card"
      aria-label={headerTitle}
    >
      {items.length > 0 ? (
        <>
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
              const isActive =
                item.status === "active" ||
                item.status === "hashing" ||
                item.status === "verifying";
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
                    item.status === "hashing" ||
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
                    <Progress
                      value={item.offset}
                      max={item.total || 1}
                      variant={uploadProgressVariant(item.status)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium">{headerTitle}</h2>
        </div>
      )}
      {cloudMultipart ? <MultipartSessionsSection {...cloudMultipart} /> : null}
    </section>
  );
}
