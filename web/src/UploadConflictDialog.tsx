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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(event) => setApplyToAll(event.target.checked)}
          />
          {t("upload.conflict.applyToAll")}
        </label>
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
