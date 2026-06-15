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
};

export default function BackendStatus({ status, kernelVersion }: BackendStatusProps) {
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

  return (
    <div
      className="inline-flex shrink-0 items-center"
      role="status"
      aria-label={t("backend.status", { status: label })}
    >
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              status === "connected" && "bg-success",
              status === "connecting" && "bg-warning",
              status === "offline" && "bg-destructive",
            )}
            tabIndex={0}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-wrap">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
