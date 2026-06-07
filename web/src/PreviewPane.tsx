import { useEffect, useState, type ReactNode } from "react";

import { TriangleAlertIcon } from "lucide-react";

import { messageFromApiResponse } from "./apiError";
import { useExplorerBackend, type FileStat } from "./backend";
import { isBrowserPreviewImage } from "./imagePaths";
import { formatSize } from "./listing-format";
import { useTranslation } from "@/i18n";
import { useDownloadUrl } from "./useDownloadUrl";
import {
  cloudExtraString,
  countDirectoryChildren,
  formatKindLabel,
  formatPreviewModified,
  resolveSymlinkTarget,
} from "./preview-metadata";
import { useModifiedTimeFormat } from "@/settings/ModifiedTimeFormatProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PreviewPaneProps = {
  path: string | null;
  className?: string;
  onFocusPreview?: () => void;
  onSymlinkTargetClick?: (resolvedPath: string) => void;
};

type DirectorySummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; files: number; folders: number; truncated: boolean }
  | { status: "error" };

function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function PreviewPane({
  path,
  className,
  onFocusPreview,
  onSymlinkTargetClick,
}: PreviewPaneProps) {
  const backend = useExplorerBackend();
  const { t, locale } = useTranslation();
  const { format: modifiedTimeFormat } = useModifiedTimeFormat();
  const [stat, setStat] = useState<FileStat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirSummary, setDirSummary] = useState<DirectorySummaryState>({ status: "idle" });
  const downloadUrl = useDownloadUrl(backend, stat && !stat.is_dir ? stat.path : null);

  useEffect(() => {
    if (!path) {
      setStat(null);
      setError(null);
      setDirSummary({ status: "idle" });
      return;
    }

    setStat(null);
    setError(null);
    setDirSummary({ status: "idle" });

    backend
      .stat(path)
      .then((data) => {
        setStat(data);
        setError(null);
      })
      .catch(async (err) => {
        setStat(null);
        if (err instanceof Response) {
          setError(await messageFromApiResponse(err, t));
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [path, backend, t]);

  useEffect(() => {
    if (!stat?.is_dir) {
      setDirSummary({ status: "idle" });
      return;
    }

    const dirPath = stat.path;
    let cancelled = false;
    setDirSummary({ status: "loading" });

    void backend
      .list(dirPath)
      .then((result) => {
        if (cancelled) {
          return;
        }
        const counts = countDirectoryChildren(result.entries);
        setDirSummary({
          status: "ready",
          ...counts,
          truncated: Boolean(result.nextCursor),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDirSummary({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stat?.is_dir, stat?.path, backend]);

  const shellClass = cn(
    "relative min-h-[320px] overflow-auto rounded-xl border bg-card p-4",
    className,
  );

  if (!path) {
    return (
      <aside className={shellClass} aria-label={t("preview.label")}>
        <p className="text-sm text-muted-foreground">{t("preview.selectFile")}</p>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className={shellClass} aria-label={t("preview.label")}>
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{t("preview.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </aside>
    );
  }

  if (!stat) {
    return (
      <aside className={shellClass} aria-label={t("preview.label")}>
        <p className="text-sm text-muted-foreground">{t("preview.loading")}</p>
      </aside>
    );
  }

  const canPreviewImage = !stat.is_dir && isBrowserPreviewImage(stat.path);
  const typeLabel = stat.is_symlink
    ? t("preview.type.symlink")
    : stat.is_dir
      ? t("preview.type.directory")
      : t("preview.type.file");
  const kindLabel = formatKindLabel({
    isDir: stat.is_dir,
    path: stat.path,
    contentType:
      backend.mode === "s3" ? cloudExtraString(stat.extra, "contentType") : null,
    labels: {
      folder: t("preview.kind.folder"),
      noExtension: t("preview.kind.noExtension"),
    },
  });
  const modifiedLabel = formatPreviewModified(stat.modified, locale, modifiedTimeFormat);
  const symlinkResolution =
    stat.is_symlink && stat.symlink_target
      ? resolveSymlinkTarget(stat.path, stat.symlink_target)
      : null;
  const showCloudExtras = backend.mode === "s3" && !stat.is_dir;
  const etag = showCloudExtras ? cloudExtraString(stat.extra, "etag") : null;
  const storageClass = showCloudExtras ? cloudExtraString(stat.extra, "storageClass") : null;

  let contentsLabel: string | null = null;
  if (stat.is_dir) {
    if (dirSummary.status === "loading") {
      contentsLabel = t("preview.contentsLoading");
    } else if (dirSummary.status === "ready") {
      contentsLabel = dirSummary.truncated
        ? t("preview.contentsSummaryTruncated", {
            files: String(dirSummary.files),
            folders: String(dirSummary.folders),
          })
        : t("preview.contentsSummary", {
            files: String(dirSummary.files),
            folders: String(dirSummary.folders),
          });
    } else if (dirSummary.status === "error") {
      contentsLabel = "—";
    }
  }

  return (
    <aside
      className={shellClass}
      aria-label={t("preview.label")}
      onMouseDown={() => onFocusPreview?.()}
    >
      <h2 className="mb-3 text-lg font-semibold">{stat.path.split("/").pop()}</h2>
      <dl className="mb-4 grid gap-2 text-sm">
        <MetadataRow label={t("preview.path")}>
          <span className="break-all">{stat.path}</span>
        </MetadataRow>
        <MetadataRow label={t("preview.type")}>{typeLabel}</MetadataRow>
        <MetadataRow label={t("preview.kind")}>{kindLabel}</MetadataRow>
        <MetadataRow label={t("preview.modified")}>{modifiedLabel}</MetadataRow>
        {stat.is_symlink && stat.symlink_target ? (
          <MetadataRow label={t("preview.symlinkTarget")}>
            {symlinkResolution?.inRoot && symlinkResolution.resolvedPath != null ? (
              <button
                type="button"
                className="break-all text-left font-mono text-xs text-primary underline-offset-4 hover:underline"
                onClick={() => onSymlinkTargetClick?.(symlinkResolution.resolvedPath!)}
              >
                {stat.symlink_target}
              </button>
            ) : (
              <span className="break-all font-mono text-xs text-muted-foreground">
                {stat.symlink_target}
                {!symlinkResolution?.inRoot ? (
                  <span className="mt-1 block font-sans text-xs">
                    {t("preview.symlinkOutsideRoot")}
                  </span>
                ) : null}
              </span>
            )}
          </MetadataRow>
        ) : null}
        {stat.is_dir && contentsLabel != null ? (
          <MetadataRow label={t("preview.contents")}>{contentsLabel}</MetadataRow>
        ) : null}
        {!stat.is_dir ? (
          <MetadataRow label={t("preview.size")}>{formatSize(stat.size, false)}</MetadataRow>
        ) : null}
        {etag ? <MetadataRow label={t("preview.etag")}>{etag}</MetadataRow> : null}
        {storageClass ? (
          <MetadataRow label={t("preview.storageClass")}>{storageClass}</MetadataRow>
        ) : null}
      </dl>
      {!stat.is_dir ? (
        <div className="space-y-3">
          {canPreviewImage && downloadUrl ? (
            <img
              src={downloadUrl}
              alt={stat.path.split("/").pop() ?? stat.path}
              className="max-h-[480px] max-w-full rounded-md border bg-background object-contain"
            />
          ) : canPreviewImage ? (
            <p className="text-sm text-muted-foreground">{t("preview.loading")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("preview.noPreview")}</p>
          )}
          {downloadUrl ? (
            <Button variant="link" className="h-auto p-0" asChild>
              <a href={downloadUrl} download={stat.path.split("/").pop()}>
                {t("preview.download")}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
