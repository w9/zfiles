import { backendStatusMessage, useTranslation } from "@/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type BackendStatus } from "./useBackendStatus";

type BackendStatusProps = {
  status: BackendStatus;
  kernelVersion?: string | null;
  showLabel?: boolean;
};

export default function BackendStatus({
  status,
  kernelVersion,
  showLabel = false,
}: BackendStatusProps) {
  const { locale, t } = useTranslation();
  const label = backendStatusMessage(locale, status);
  const tooltipText =
    status === "connected" && kernelVersion
      ? t("backend.connectedTooltip", { version: kernelVersion })
      : status === "connected"
        ? t("backend.connectedBrief")
        : status === "connecting"
          ? t("backend.connectingTooltip")
          : status === "offline"
            ? t("backend.offlineHint")
            : label;

  const dot = (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "connected" && "bg-success",
        status === "connecting" && "bg-warning",
        status === "offline" && "bg-destructive",
      )}
      tabIndex={showLabel ? undefined : 0}
    />
  );

  return (
    <div
      className="inline-flex shrink-0 items-center gap-2"
      role="status"
      aria-label={t("backend.status", { status: label })}
    >
      {showLabel ? (
        dot
      ) : (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{dot}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-wrap">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      )}
      {showLabel ? (
        <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}
