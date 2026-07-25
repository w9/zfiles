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
import type { BackendMode } from "./backend";
import type { S3Provider } from "./cloud/types";
import { type BackendStatus } from "./useBackendStatus";

type BackendStatusProps = {
  status: BackendStatus;
  kernelVersion?: string | null;
  backendMode: BackendMode;
  cloudProvider?: S3Provider | null;
  iconOnly?: boolean;
  /** Active connection name; shown instead of the generic backend label when present. */
  connectionName?: string | null;
  onSelect?: () => void;
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
  connectionName = null,
  onSelect,
}: BackendStatusProps) {
  const { locale, t } = useTranslation();

  let connectedLabel: string;
  let connectedTooltip: string;
  switch (backendMode) {
    case "local": {
      const zfilesServer = t("backend.connectedBackend.zfilesServer");
      connectedLabel = kernelVersion
        ? t("backend.connectedTooltip", { backend: zfilesServer, version: kernelVersion })
        : t("backend.connectedTooltipBackendOnly", { backend: zfilesServer });
      connectedTooltip = kernelVersion ? connectedLabel : t("backend.connectedBrief");
      break;
    }
    case "s3": {
      const provider = cloudProvider ? t(`connect.provider.${cloudProvider}`) : null;
      connectedLabel = provider
        ? t("backend.connectedTooltip", { backend: provider, version: APP_VERSION })
        : t("backend.connectedBrief");
      connectedTooltip = provider
        ? t("backend.connectedTooltipBackendOnly", { backend: provider })
        : t("backend.connectedBrief");
      break;
    }
    case "browser": {
      connectedLabel = t("backend.browserStorage");
      connectedTooltip = t("backend.browserStorageTooltip");
      break;
    }
  }

  const label =
    status === "connected"
      ? (connectionName ?? connectedLabel)
      : backendStatusMessage(locale, status);
  const tooltipText =
    status === "connected"
      ? connectionName && onSelect
        ? t("connections.pillTooltip", { name: connectionName })
        : connectedTooltip
      : status === "connecting"
        ? t("backend.connectingTooltip")
        : t("backend.offlineHint");

  const statusAnnouncement = t("backend.status", {
    status: backendStatusMessage(locale, status),
  });
  const badgeClass = cn(
    STATUS_BAR_BADGE_CLASS,
    "truncate",
    statusBadgeClass[status],
    iconOnly && status !== "offline" && "px-0",
  );
  const content = (
    <>
      <StatusIcon status={status} />
      {iconOnly ? null : label}
    </>
  );

  return (
    <>
      {/* A button cannot also be a live region, so connection state is announced separately. */}
      {onSelect ? (
        <span className="sr-only" role="status" aria-label={statusAnnouncement}>
          {statusAnnouncement}
        </span>
      ) : null}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {onSelect ? (
            <Badge asChild variant="ghost" className={badgeClass}>
              <button
                type="button"
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                aria-label={t("connections.pillLabel", { name: label })}
                onClick={onSelect}
              >
                {content}
              </button>
            </Badge>
          ) : (
            <Badge
              variant="ghost"
              className={badgeClass}
              role="status"
              aria-label={t("backend.status", { status: label })}
            >
              {content}
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-wrap">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
