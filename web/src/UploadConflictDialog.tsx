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
import { useTranslation } from "./i18n";
import type { UploadConflictResolution } from "./upload-conflict";
import type { UploadQueueItem } from "./upload-queue";

type UploadConflictDialogProps = {
  item: UploadQueueItem | null;
  onResolve: (resolution: UploadConflictResolution, applyToAll: boolean) => void;
};

export default function UploadConflictDialog({
  item,
  onResolve,
}: UploadConflictDialogProps) {
  const { t } = useTranslation();
  const [applyToAll, setApplyToAll] = useState(false);

  const handleResolve = (resolution: UploadConflictResolution) => {
    onResolve(resolution, applyToAll);
    setApplyToAll(false);
  };

  return (
    <Dialog open={item != null}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("upload.conflict.title")}</DialogTitle>
          <DialogDescription>
            {item
              ? t("upload.conflict.message", {
                  fileName: item.fileName,
                  destPath: item.destPath,
                })
              : null}
          </DialogDescription>
        </DialogHeader>
        <Field orientation="horizontal">
          <Checkbox
            id="upload-conflict-apply-to-all"
            checked={applyToAll}
            onCheckedChange={(checked) => setApplyToAll(checked === true)}
          />
          <FieldLabel htmlFor="upload-conflict-apply-to-all">
            {t("upload.conflict.applyToAll")}
          </FieldLabel>
        </Field>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => handleResolve("skip")}>
            {t("upload.conflict.skip")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleResolve("keep_both")}>
            {t("upload.conflict.keepBoth")}
          </Button>
          <Button type="button" onClick={() => handleResolve("replace")}>
            {t("upload.conflict.replace")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
