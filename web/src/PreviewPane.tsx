import { useEffect, useState } from "react";

import { TriangleAlertIcon } from "lucide-react";

import { messageFromApiResponse } from "./apiError";
import { useExplorerBackend, type FileStat } from "./backend";
import { useCloudAuth } from "./cloud/CloudAuthContext";
import { formatSize } from "./listing-format";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  cloudExtraString,
  countDirectoryChildren,
  formatKindLabel,
  formatPreviewModified,
  resolveSymlinkTarget,
} from "./preview-metadata";
import { useModifiedTimeFormat } from "@/settings/ModifiedTimeFormatProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import MetadataValueRow from "./MetadataValueRow";

type PreviewPaneProps = {
  path: string | null;
  className?: string;
  showTitle?: boolean;
  onSymlinkTargetClick?: (resolvedPath: string) => void;
};

type DirectorySummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; files: number; folders: number; truncated: boolean }
  | { status: "error" };

export default function PreviewPane({
  path,
  className,
  showTitle = true,
  onSymlinkTargetClick,
}: PreviewPaneProps) {
  const backend = useExplorerBackend();
  const cloudAuth = useCloudAuth();
  const { t, locale } = useTranslation();
  const { format: modifiedTimeFormat } = useModifiedTimeFormat();
  const [stat, setStat] = useState<FileStat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirSummary, setDirSummary] = useState<DirectorySummaryState>({ status: "idle" });

  useEffect(() => {
    if (!path || cloudAuth.expired) {
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
        if (cloudAuth.handleAuthError(err)) {
          return;
        }
        if (err instanceof Response) {
          setError(await messageFromApiResponse(err, t));
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [path, backend, cloudAuth.expired, cloudAuth.handleAuthError, t]);

  useEffect(() => {
    if (!stat?.is_dir || cloudAuth.expired) {
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
      .catch((err) => {
        if (cloudAuth.handleAuthError(err)) {
          return;
        }
        if (!cancelled) {
          setDirSummary({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stat?.is_dir, stat?.path, backend, cloudAuth.expired, cloudAuth.handleAuthError]);

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
    <aside className={shellClass} aria-label={t("preview.label")}>
      {showTitle ? (
        <h2 className="mb-3 text-lg font-semibold">{stat.path.split("/").pop()}</h2>
      ) : null}
      <dl className="mb-4 grid gap-2 text-sm">
        <MetadataValueRow rowKey="path" label={t("preview.path")} copyText={stat.path}>
          <span className="break-all">{stat.path}</span>
        </MetadataValueRow>
        <MetadataValueRow rowKey="type" label={t("preview.type")} copyText={typeLabel}>
          {typeLabel}
        </MetadataValueRow>
        <MetadataValueRow rowKey="kind" label={t("preview.kind")} copyText={kindLabel}>
          {kindLabel}
        </MetadataValueRow>
        <MetadataValueRow rowKey="modified" label={t("preview.modified")} copyText={modifiedLabel}>
          {modifiedLabel}
        </MetadataValueRow>
        {stat.is_symlink && stat.symlink_target ? (
          <MetadataValueRow
            rowKey="symlinkTarget"
            label={t("preview.symlinkTarget")}
            copyText={stat.symlink_target}
          >
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
          </MetadataValueRow>
        ) : null}
        {stat.is_dir && contentsLabel != null ? (
          <MetadataValueRow
            rowKey="contents"
            label={t("preview.contents")}
            copyText={dirSummary.status === "ready" ? contentsLabel : null}
          >
            {contentsLabel}
          </MetadataValueRow>
        ) : null}
        {!stat.is_dir ? (
          <MetadataValueRow
            rowKey="size"
            label={t("preview.size")}
            copyText={formatSize(stat.size, false)}
          >
            {formatSize(stat.size, false)}
          </MetadataValueRow>
        ) : null}
        {etag ? (
          <MetadataValueRow rowKey="etag" label={t("preview.etag")} copyText={etag}>
            {etag}
          </MetadataValueRow>
        ) : null}
        {storageClass ? (
          <MetadataValueRow rowKey="storageClass" label={t("preview.storageClass")} copyText={storageClass}>
            {storageClass}
          </MetadataValueRow>
        ) : null}
      </dl>
    </aside>
  );
}
