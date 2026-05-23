import { Badge } from "@/components/ui/badge";
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
  const detail =
    status === "connected" && kernelVersion
      ? t("backend.kernelVersion", { version: kernelVersion })
      : label;

  const variant =
    status === "offline" ? "destructive" : status === "connecting" ? "outline" : "secondary";

  return (
    <Badge
      variant={variant}
      className={cn(
        "gap-2",
        compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        status === "connected" &&
          "border-success/30 bg-success/10 text-success hover:bg-success/10",
        status === "connecting" &&
          "border-warning/30 bg-warning/10 text-warning hover:bg-warning/10",
      )}
      role="status"
      aria-label={t("backend.status", { status: label })}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      <span>{detail}</span>
    </Badge>
  );
}
