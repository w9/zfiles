import { useEffect, useState } from "react";

import { TriangleAlertIcon } from "lucide-react";

import { messageFromApiResponse } from "./apiError";
import { useExplorerBackend } from "./backend";
import { isBrowserPreviewImage } from "./imagePaths";
import { formatSize } from "./listing-format";
import { useTranslation } from "@/i18n";
import { useDownloadUrl } from "./useDownloadUrl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileStat = {
  path: string;
  is_dir: boolean;
  size: number;
  modified?: string;
};

type PreviewPaneProps = {
  path: string | null;
  className?: string;
  onFocusPreview?: () => void;
};

export default function PreviewPane({
  path,
  className,
  onFocusPreview,
}: PreviewPaneProps) {
  const backend = useExplorerBackend();
  const { t } = useTranslation();
  const [stat, setStat] = useState<FileStat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadUrl = useDownloadUrl(backend, stat && !stat.is_dir ? stat.path : null);

  useEffect(() => {
    if (!path) {
      setStat(null);
      setError(null);
      return;
    }

    setStat(null);
    setError(null);

    backend
      .stat(path)
      .then((data) => {
        setStat(data as FileStat);
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

  return (
    <aside
      className={shellClass}
      aria-label={t("preview.label")}
      onMouseDown={() => onFocusPreview?.()}
    >
      <h2 className="mb-3 text-lg font-semibold">{stat.path.split("/").pop()}</h2>
      <dl className="mb-4 grid gap-2 text-sm">
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <dt className="text-muted-foreground">{t("preview.path")}</dt>
          <dd className="break-all">{stat.path}</dd>
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <dt className="text-muted-foreground">{t("preview.type")}</dt>
          <dd>
            {stat.is_dir ? t("preview.type.directory") : t("preview.type.file")}
          </dd>
        </div>
        {!stat.is_dir ? (
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <dt className="text-muted-foreground">{t("preview.size")}</dt>
            <dd>{formatSize(stat.size, false)}</dd>
          </div>
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
