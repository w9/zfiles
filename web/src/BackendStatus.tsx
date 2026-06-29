import { Globe, GlobeOff, Loader2 } from "lucide-react";

import { APP_VERSION } from "@/appVersion";
import { backendStatusMessage, useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { STATUS_BAR_BADGE_CLASS } from "./statusBarLayout";
import type { S3Provider } from "./cloud/types";
import { type BackendStatus } from "./useBackendStatus";

type BackendStatusProps = {
  status: BackendStatus;
  kernelVersion?: string | null;
  backendMode: "local" | "s3";
  cloudProvider?: S3Provider | null;
  iconOnly?: boolean;
};

const statusIconClass: Record<BackendStatus, string> = {
  connected: "text-success",
  connecting: "text-warning",
  offline: "text-current",
};

const statusBadgeClass: Record<BackendStatus, string> = {
  connected: "max-w-[min(100%,24rem)] px-0 text-muted-foreground",
  connecting: "px-0 text-muted-foreground",
  offline:
    "max-w-[min(100%,24rem)] bg-destructive text-destructive-foreground dark:bg-[#7f1818] dark:text-[#fce8e6]",
};

function StatusIcon({ status }: { status: BackendStatus }) {
  const className = cn("size-3 shrink-0", statusIconClass[status]);
  switch (status) {
    case "connected":
      return <Globe className={className} aria-hidden />;
    case "connecting":
      return <Loader2 className={cn(className, "animate-spin")} aria-hidden />;
    case "offline":
      return <GlobeOff className={className} aria-hidden />;
  }
}

export default function BackendStatus({
  status,
  kernelVersion,
  backendMode,
  cloudProvider = null,
  iconOnly = false,
}: BackendStatusProps) {
  const { locale, t } = useTranslation();
  const label =
    status === "connected"
      ? backendMode === "local"
        ? kernelVersion
          ? t("backend.connectedTooltip", {
              backend: t("backend.connectedBackend.zfilesServer"),
              version: kernelVersion,
            })
          : t("backend.connectedTooltipBackendOnly", {
              backend: t("backend.connectedBackend.zfilesServer"),
            })
        : backendMode === "s3" && cloudProvider
          ? t("backend.connectedTooltip", {
              backend: t(`connect.provider.${cloudProvider}`),
              version: APP_VERSION,
            })
          : t("backend.connectedBrief")
      : backendStatusMessage(locale, status);
  const tooltipText =
    status === "connected" && backendMode === "local" && kernelVersion
      ? t("backend.connectedTooltip", {
          backend: t("backend.connectedBackend.zfilesServer"),
          version: kernelVersion,
        })
      : status === "connected" && backendMode === "s3" && cloudProvider
        ? t("backend.connectedTooltipBackendOnly", {
            backend: t(`connect.provider.${cloudProvider}`),
          })
        : status === "connected"
          ? t("backend.connectedBrief")
          : status === "connecting"
            ? t("backend.connectingTooltip")
            : status === "offline"
              ? t("backend.offlineHint")
              : label;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Badge
          variant="ghost"
          className={cn(
            STATUS_BAR_BADGE_CLASS,
            "truncate",
            statusBadgeClass[status],
            iconOnly && status !== "offline" && "px-0",
          )}
          role="status"
          aria-label={t("backend.status", { status: label })}
        >
          <StatusIcon status={status} />
          {iconOnly ? null : label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-wrap">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
