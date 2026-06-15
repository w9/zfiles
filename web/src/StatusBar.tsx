import BackendStatus from "./BackendStatus";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { BackendStatus as BackendStatusValue } from "./useBackendStatus";

type StatusBarProps = {
  backendStatus: BackendStatusValue;
  kernelVersion?: string | null;
  selectedCount?: number;
  cutStatusText?: string | null;
  onVersionClick?: () => void;
  className?: string;
};

export default function StatusBar({
  backendStatus,
  kernelVersion,
  selectedCount = 0,
  cutStatusText = null,
  onVersionClick,
  className,
}: StatusBarProps) {
  const { t } = useTranslation();
  const selectionLabel =
    selectedCount === 1
      ? t("selection.fileSelected")
      : selectedCount > 1
        ? t("selection.filesSelected", { count: String(selectedCount) })
        : null;

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-3 overflow-hidden rounded-xl bg-card px-3",
        backendStatus === "offline" && "bg-destructive/10",
        className,
      )}
      role="contentinfo"
      aria-label={t("statusBar.label")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BackendStatus status={backendStatus} kernelVersion={kernelVersion} />
        {cutStatusText ? (
          <p className="truncate text-xs text-muted-foreground">{cutStatusText}</p>
        ) : null}
        {selectionLabel ? (
          <p className="shrink-0 text-xs text-muted-foreground">{selectionLabel}</p>
        ) : null}
      </div>
      {kernelVersion ? (
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={onVersionClick}
          aria-label={t("statusBar.openAbout", { version: kernelVersion })}
        >
          {t("backend.kernelVersion", { version: kernelVersion })}
        </button>
      ) : null}
    </div>
  );
}
