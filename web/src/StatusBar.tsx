import BackendStatus from "./BackendStatus";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { BackendStatus as BackendStatusValue } from "./useBackendStatus";

type StatusBarProps = {
  backendStatus: BackendStatusValue;
  kernelVersion?: string | null;
  selectedCount?: number;
  className?: string;
};

export default function StatusBar({
  backendStatus,
  kernelVersion,
  selectedCount = 0,
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
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2",
        className,
      )}
      role="contentinfo"
      aria-label={t("statusBar.label")}
    >
      <BackendStatus status={backendStatus} kernelVersion={kernelVersion} compact />
      {selectionLabel ? (
        <p className="text-xs text-muted-foreground">{selectionLabel}</p>
      ) : null}
    </div>
  );
}
