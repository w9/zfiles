import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";

type ConnectionFailureDialogProps = {
  open: boolean;
  name: string;
  message?: string | null;
  /** Cancelling leaves the last listing on screen, so it is only offered once one exists. */
  allowCancel: boolean;
  busy: boolean;
  onRetry: () => void;
  onUseDifferent: () => void;
  onCancel: () => void;
};

export default function ConnectionFailureDialog({
  open,
  name,
  message = null,
  allowCancel,
  busy,
  onRetry,
  onUseDifferent,
  onCancel,
}: ConnectionFailureDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && allowCancel) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={allowCancel}>
        <DialogHeader>
          <DialogTitle>{t("connections.failure.title")}</DialogTitle>
          <DialogDescription>
            {t("connections.failure.description", { name })}
          </DialogDescription>
        </DialogHeader>
        {message ? (
          <p className="text-sm break-words text-muted-foreground">{message}</p>
        ) : null}
        <DialogFooter className="gap-2">
          {allowCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              {t("connect.cancel")}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onUseDifferent} disabled={busy}>
            {t("connections.failure.useDifferent")}
          </Button>
          <Button type="button" onClick={onRetry} disabled={busy}>
            {busy ? t("connect.connecting") : t("connections.failure.retry")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
