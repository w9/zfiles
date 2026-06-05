import { useState } from "react";

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

export type PasteConflictResolution = "skip" | "replace" | "cancel";

type PasteConflictDialogProps = {
  sourceName: string;
  destName: string;
  typeMismatch: boolean;
  onResolve: (resolution: PasteConflictResolution) => void;
};

export default function PasteConflictDialog({
  sourceName,
  destName,
  typeMismatch,
  onResolve,
}: PasteConflictDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const closeWith = (resolution: PasteConflictResolution) => {
    setOpen(false);
    onResolve(resolution);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeWith("cancel");
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("paste.conflict.title")}</DialogTitle>
          <DialogDescription>
            {typeMismatch
              ? t("paste.conflict.typeMismatch", { sourceName, destName })
              : t("paste.conflict.message", { sourceName, destName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => closeWith("cancel")}>
            {t("actions.confirm.cancel")}
          </Button>
          <Button type="button" variant="outline" onClick={() => closeWith("skip")}>
            {t("paste.conflict.skip")}
          </Button>
          {!typeMismatch ? (
            <Button type="button" onClick={() => closeWith("replace")}>
              {t("paste.conflict.replace")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
