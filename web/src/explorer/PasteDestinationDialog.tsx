import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { useTranslation } from "@/i18n";
export type PasteDestinationChoice = "into_selected_folder" | "into_current_directory";

type PasteDestinationDialogProps = {
  open: boolean;
  folderName: string;
  currentFolderName: string;
  onChoose: (choice: PasteDestinationChoice, remember: boolean) => void;
  onCancel: () => void;
};

export default function PasteDestinationDialog({
  open,
  folderName,
  currentFolderName,
  onChoose,
  onCancel,
}: PasteDestinationDialogProps) {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(false);

  const choose = (choice: PasteDestinationChoice) => {
    onChoose(choice, remember);
    setRemember(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("paste.destination.title")}</DialogTitle>
          <DialogDescription>{t("paste.destination.description")}</DialogDescription>
        </DialogHeader>
        <Field orientation="horizontal">
          <Checkbox
            id="paste-destination-remember"
            checked={remember}
            onCheckedChange={(checked) => setRemember(checked === true)}
          />
          <FieldLabel htmlFor="paste-destination-remember">
            {t("paste.destination.remember")}
          </FieldLabel>
        </Field>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("actions.confirm.cancel")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => choose("into_current_directory")}
          >
            {t("paste.destination.intoCurrent", { name: currentFolderName })}
          </Button>
          <Button type="button" onClick={() => choose("into_selected_folder")}>
            {t("paste.destination.intoSelected", { name: folderName })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
