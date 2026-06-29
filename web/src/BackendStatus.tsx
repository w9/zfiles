import { Globe, GlobeOff, Loader2 } from "lucide-react";

import { backendStatusMessage, useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { S3Provider } from "./cloud/types";
import { type BackendStatus } from "./useBackendStatus";

type BackendStatusProps = {
  status: BackendStatus;
  kernelVersion?: string | null;
  backendMode: "local" | "s3";
  cloudProvider?: S3Provider | null;
};

const statusIconClass: Record<BackendStatus, string> = {
  connected: "text-success",
  connecting: "text-warning",
  offline: "text-destructive",
};

const statusBadgeClass: Record<BackendStatus, string> = {
  connected: "border-muted-foreground/30 text-muted-foreground",
  connecting: "border-muted-foreground/30 text-muted-foreground",
  offline: "border-destructive/40 text-destructive",
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
}: BackendStatusProps) {
  const { locale, t } = useTranslation();
  const label = backendStatusMessage(locale, status);
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
          variant="outline"
          className={cn("gap-1 text-sm", statusBadgeClass[status])}
          role="status"
          aria-label={t("backend.status", { status: label })}
        >
          <StatusIcon status={status} />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-wrap">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
