import BackendStatus from "./BackendStatus";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { BackendStatus as BackendStatusValue } from "./useBackendStatus";

type StatusBarProps = {
  backendStatus: BackendStatusValue;
  kernelVersion?: string | null;
  selectedCount?: number;
  cutStatusText?: string | null;
  className?: string;
};

export default function StatusBar({
  backendStatus,
  kernelVersion,
  selectedCount = 0,
  cutStatusText = null,
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
        "flex h-9 shrink-0 items-center justify-between gap-3 overflow-hidden rounded-xl bg-card px-3",
        className,
      )}
      role="contentinfo"
      aria-label={t("statusBar.label")}
    >
      <BackendStatus status={backendStatus} kernelVersion={kernelVersion} compact />
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {cutStatusText ? (
          <p className="truncate text-xs text-muted-foreground">{cutStatusText}</p>
        ) : null}
        {selectionLabel ? (
          <p className="shrink-0 text-xs text-muted-foreground">{selectionLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
