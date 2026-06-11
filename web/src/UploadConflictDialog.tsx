import { useEffect, useState } from "react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ExplorerBackend } from "./backend/types";
import { basename } from "./fileOperations/paths";
import { useTranslation } from "./i18n";
import { findKeepBothPath, type UploadConflictResolution } from "./upload-conflict";
import type { UploadQueueItem } from "./upload-queue";

type UploadConflictDialogProps = {
  backend: ExplorerBackend;
  item: UploadQueueItem | null;
  onResolve: (resolution: UploadConflictResolution, applyToAll: boolean) => void;
};

export default function UploadConflictDialog({
  backend,
  item,
  onResolve,
}: UploadConflictDialogProps) {
  const { t } = useTranslation();
  const [applyToAll, setApplyToAll] = useState(false);
  const [keepBothName, setKeepBothName] = useState<string | null>(null);
  const [keepBothLoading, setKeepBothLoading] = useState(false);

  useEffect(() => {
    if (!item) {
      setKeepBothName(null);
      setKeepBothLoading(false);
      return;
    }

    let cancelled = false;
    setKeepBothLoading(true);
    setKeepBothName(null);

    void findKeepBothPath(backend, item.destPath)
      .then((path) => {
        if (!cancelled) {
          setKeepBothName(basename(path));
          setKeepBothLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKeepBothLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [backend, item?.destPath, item?.id]);

  const keepBothTooltip =
    keepBothLoading || keepBothName == null
      ? t("upload.conflict.keepBothTooltipLoading")
      : t("upload.conflict.keepBothTooltip", { name: keepBothName });

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
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleResolve("keep_both")}
              >
                {t("upload.conflict.keepBoth")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{keepBothTooltip}</TooltipContent>
          </Tooltip>
          <Button type="button" onClick={() => handleResolve("replace")}>
            {t("upload.conflict.replace")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
