import { Fragment, type ReactNode } from "react";
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
  selectionStatusText?: string | null;
  cutStatusText?: string | null;
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
  selectionStatusText = null,
  cutStatusText = null,
  className,
}: StatusBarProps) {
  const { t } = useTranslation();

  const segments: ReactNode[] = [
    <BackendStatus
      key="backend"
      status={backendStatus}
      backendMode={backendMode}
      cloudProvider={cloudProvider}
      kernelVersion={kernelVersion}
    />,
  ];

  if (readOnly) {
    segments.push(
      <Tooltip key="read-only" delayDuration={0}>
        <TooltipTrigger asChild>
          <Badge
            variant="ghost"
            className="gap-1 px-0 text-sm font-normal text-muted-foreground"
          >
            <Lock className="size-3" aria-hidden />
            {t("statusBar.readOnly")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-wrap">
          {t("statusBar.readOnlyTooltip")}
        </TooltipContent>
      </Tooltip>,
    );
  }

  if (cutStatusText) {
    segments.push(
      <p key="cut" className="truncate text-sm text-muted-foreground">
        {cutStatusText}
      </p>,
    );
  }

  if (selectionStatusText) {
    segments.push(
      <p key="selection" className="shrink-0 text-sm text-muted-foreground">
        {selectionStatusText}
      </p>,
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 shrink-0 items-center overflow-hidden",
        className,
      )}
      role="contentinfo"
      aria-label={t("statusBar.label")}
    >
      <div className="flex min-w-0 flex-1 items-center">
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
