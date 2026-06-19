import { Lock } from "lucide-react";

import BackendStatus from "./BackendStatus";
import { APP_VERSION } from "@/appVersion";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BackendStatus as BackendStatusValue } from "./useBackendStatus";
import type { S3Provider } from "./cloud/types";

type StatusBarProps = {
  backendStatus: BackendStatusValue;
  backendMode: "local" | "s3";
  cloudProvider?: S3Provider | null;
  kernelVersion?: string | null;
  readOnly?: boolean;
  selectionStatusText?: string | null;
  cutStatusText?: string | null;
  onVersionClick?: () => void;
  className?: string;
};

export default function StatusBar({
  backendStatus,
  backendMode,
  cloudProvider = null,
  kernelVersion,
  readOnly = false,
  selectionStatusText = null,
  cutStatusText = null,
  onVersionClick,
  className,
}: StatusBarProps) {
  const { t } = useTranslation();
  const displayVersion = backendMode === "local" ? kernelVersion : APP_VERSION;
  const showVersion = Boolean(displayVersion);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 shrink-0 items-center justify-between overflow-hidden",
        className,
      )}
      role="contentinfo"
      aria-label={t("statusBar.label")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BackendStatus
          status={backendStatus}
          backendMode={backendMode}
          cloudProvider={cloudProvider}
          kernelVersion={kernelVersion}
        />
        {readOnly ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="gap-1 border-muted-foreground/30 text-muted-foreground"
              >
                <Lock className="size-3.5" aria-hidden />
                {t("statusBar.readOnly")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-wrap">
              {t("statusBar.readOnlyTooltip")}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {cutStatusText ? (
          <p className="truncate text-sm text-muted-foreground">{cutStatusText}</p>
        ) : null}
        {selectionStatusText ? (
          <p className="shrink-0 text-sm text-muted-foreground">{selectionStatusText}</p>
        ) : null}
      </div>
      {showVersion ? (
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={onVersionClick}
            aria-label={t("statusBar.openAbout", { version: displayVersion })}
          >
            {t("statusBar.serverVersion", { version: displayVersion })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
