import BackendStatus from "./BackendStatus";
import LanguageToggle from "./LanguageToggle";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { BackendStatus as BackendStatusValue } from "./useBackendStatus";

type StatusBarProps = {
  backendStatus: BackendStatusValue;
  kernelVersion?: string | null;
  className?: string;
};

export default function StatusBar({
  backendStatus,
  kernelVersion,
  className,
}: StatusBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2",
        className,
      )}
      role="contentinfo"
      aria-label={t("statusBar.label")}
    >
      <BackendStatus status={backendStatus} kernelVersion={kernelVersion} compact />
      <LanguageToggle compact />
    </div>
  );
}
