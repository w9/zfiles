import { backendStatusMessage, useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { type BackendStatus } from "./useBackendStatus";

type BackendStatusProps = {
  status: BackendStatus;
  kernelVersion?: string | null;
  compact?: boolean;
};

export default function BackendStatus({
  status,
  kernelVersion,
  compact = false,
}: BackendStatusProps) {
  const { locale, t } = useTranslation();
  const label = backendStatusMessage(locale, status);
  const hoverTitle =
    status === "connected" && kernelVersion
      ? t("backend.kernelVersion", { version: kernelVersion })
      : status === "offline"
        ? t("backend.offlineHint")
        : undefined;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        compact ? "text-xs" : "text-sm",
      )}
      role="status"
      aria-label={t("backend.status", { status: label })}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          status === "connected" && "bg-success",
          status === "connecting" && "bg-warning",
          status === "offline" && "bg-destructive",
        )}
        aria-hidden="true"
      />
      <span title={hoverTitle}>{label}</span>
    </div>
  );
}
