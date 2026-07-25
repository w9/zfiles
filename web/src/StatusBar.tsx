import { Fragment, type ReactNode } from "react";
import { ListChecks, Lock } from "lucide-react";

import BackendStatus from "./BackendStatus";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  STATUS_BAR_BADGE_CLASS,
  STATUS_BAR_ROW_HEIGHT_CLASS,
  STATUS_BAR_SEGMENT_CLASS,
  shouldCollapseStatusBarBadges,
} from "./statusBarLayout";
import type { BackendStatus as BackendStatusValue } from "./useBackendStatus";
import type { BackendMode } from "./backend";
import type { S3Provider } from "./cloud/types";

type StatusBarProps = {
  backendStatus: BackendStatusValue;
  backendMode: BackendMode;
  cloudProvider?: S3Provider | null;
  kernelVersion?: string | null;
  readOnly?: boolean;
  compactTouchChrome?: boolean;
  selectionModeActive?: boolean;
  selectionStatusText?: string | null;
  cutStatusText?: string | null;
  connectionName?: string | null;
  onSelectConnection?: () => void;
  className?: string;
};

function StatusBarDivider() {
  return (
    <div
      className="mx-2 h-3.5 w-px shrink-0 bg-border/70"
      aria-hidden
    />
  );
}

export default function StatusBar({
  backendStatus,
  backendMode,
  cloudProvider = null,
  kernelVersion,
  readOnly = false,
  compactTouchChrome = false,
  selectionModeActive = false,
  selectionStatusText = null,
  cutStatusText = null,
  connectionName = null,
  onSelectConnection,
  className,
}: StatusBarProps) {
  const { t } = useTranslation();
  const iconOnlyBadges = shouldCollapseStatusBarBadges(
    compactTouchChrome,
    selectionStatusText,
    cutStatusText,
  );

  const segments: ReactNode[] = [
    <BackendStatus
      key="backend"
      status={backendStatus}
      backendMode={backendMode}
      cloudProvider={cloudProvider}
      kernelVersion={kernelVersion}
      iconOnly={iconOnlyBadges}
      connectionName={connectionName}
      onSelect={onSelectConnection}
    />,
  ];

  if (readOnly) {
    segments.push(
      <Tooltip key="read-only" delayDuration={0}>
        <TooltipTrigger asChild>
          <Badge
            variant="ghost"
            className={cn(
              STATUS_BAR_BADGE_CLASS,
              "px-0 text-muted-foreground",
            )}
          >
            <Lock className="size-3" aria-hidden />
            {iconOnlyBadges ? null : t("statusBar.readOnly")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-wrap">
          {t("statusBar.readOnlyTooltip")}
        </TooltipContent>
      </Tooltip>,
    );
  }

  if (selectionModeActive) {
    segments.push(
      <Tooltip key="selection-mode" delayDuration={0}>
        <TooltipTrigger asChild>
          <Badge
            variant="ghost"
            className={cn(
              STATUS_BAR_BADGE_CLASS,
              "px-0 text-muted-foreground",
            )}
            role="status"
            aria-label={t("selection.mode.active")}
          >
            <ListChecks className="size-3 shrink-0" aria-hidden />
            {iconOnlyBadges ? null : t("selection.mode.active")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-wrap">
          {t("selection.mode.active")}
        </TooltipContent>
      </Tooltip>,
    );
  }

  if (cutStatusText) {
    segments.push(
      <p
        key="cut"
        className={cn(
          STATUS_BAR_SEGMENT_CLASS,
          "text-sm text-muted-foreground",
        )}
      >
        {cutStatusText}
      </p>,
    );
  }

  if (selectionStatusText) {
    segments.push(
      <p
        key="selection"
        className={cn(
          STATUS_BAR_SEGMENT_CLASS,
          "text-sm text-muted-foreground",
        )}
      >
        {selectionStatusText}
      </p>,
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 shrink-0 items-center overflow-hidden",
        STATUS_BAR_ROW_HEIGHT_CLASS,
        className,
      )}
      role="contentinfo"
      aria-label={t("statusBar.label")}
    >
      <div className="flex h-full min-w-0 flex-1 items-center">
        {segments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 ? <StatusBarDivider /> : null}
            {segment}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
