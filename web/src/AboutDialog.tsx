import { APP_VERSION } from "@/appVersion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";

type AboutDialogProps = {
  open: boolean;
  kernelVersion?: string | null;
  onOpenChange: (open: boolean) => void;
};

export default function AboutDialog({
  open,
  kernelVersion,
  onOpenChange,
}: AboutDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("about.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("about.tagline")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-lg font-semibold text-foreground">{t("about.appName")}</p>
            <p className="text-muted-foreground">{t("about.tagline")}</p>
          </div>
          <dl className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{t("about.versionLabel")}</dt>
              <dd className="font-medium text-foreground">{APP_VERSION}</dd>
            </div>
            {kernelVersion ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{t("about.kernelVersionLabel")}</dt>
                <dd className="font-medium text-foreground">{kernelVersion}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            {t("about.license")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
