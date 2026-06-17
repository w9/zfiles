import { Lock } from "lucide-react";

import BackendStatus from "./BackendStatus";
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
  selectedCount?: number;
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
  selectedCount = 0,
  cutStatusText = null,
  onVersionClick,
  className,
}: StatusBarProps) {
  const { t } = useTranslation();
  const selectionLabel =
    selectedCount > 0
      ? t("selection.count", { count: String(selectedCount) })
      : null;

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-3 overflow-hidden rounded-xl bg-card px-3",
        backendStatus === "offline" && "bg-destructive/10",
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
                <Lock className="size-3" aria-hidden />
                {t("statusBar.readOnly")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-wrap">
              {t("statusBar.readOnlyTooltip")}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {cutStatusText ? (
          <p className="truncate text-xs text-muted-foreground">{cutStatusText}</p>
        ) : null}
        {selectionLabel ? (
          <p className="shrink-0 text-xs text-muted-foreground">{selectionLabel}</p>
        ) : null}
      </div>
      {backendMode === "local" && kernelVersion ? (
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={onVersionClick}
          aria-label={t("statusBar.openAbout", { version: kernelVersion })}
        >
          {t("statusBar.serverVersion", { version: kernelVersion })}
        </button>
      ) : null}
    </div>
  );
}
