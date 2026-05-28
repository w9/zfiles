import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { useExplorerBackend } from "./backend";

type SlideshowDialogProps = {
  open: boolean;
  paths: string[];
  startPath: string | null;
  onOpenChange: (open: boolean) => void;
};

export default function SlideshowDialog({
  open,
  paths,
  startPath,
  onOpenChange,
}: SlideshowDialogProps) {
  const backend = useExplorerBackend();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!open || paths.length === 0) {
      return;
    }
    const startIndex = startPath ? Math.max(0, paths.indexOf(startPath)) : 0;
    setIndex(startIndex >= 0 ? startIndex : 0);
    setPlaying(true);
  }, [open, paths, startPath]);

  const currentPath = paths[index] ?? null;

  const goNext = useCallback(() => {
    setIndex((current) => (current + 1) % paths.length);
  }, [paths.length]);

  const goPrev = useCallback(() => {
    setIndex((current) => (current - 1 + paths.length) % paths.length);
  }, [paths.length]);

  useEffect(() => {
    if (!open || !playing || paths.length <= 1) {
      return;
    }
    const handle = window.setInterval(goNext, 4000);
    return () => window.clearInterval(handle);
  }, [open, playing, paths.length, goNext]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, goNext, goPrev, onOpenChange]);

  if (!currentPath) {
    return null;
  }

  const fileName = currentPath.split("/").pop() ?? currentPath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-4">
        <DialogHeader>
          <DialogTitle>{t("slideshow.title", { name: fileName })}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-[360px] items-center justify-center rounded-lg border bg-muted/20 p-4">
          <img
            src={backend.thumbnailUrl(currentPath, "preview")}
            alt={fileName}
            className="max-h-[70vh] max-w-full object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t("slideshow.counter", {
              current: String(index + 1),
              total: String(paths.length),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={goPrev}>
              {t("slideshow.previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? t("slideshow.pause") : t("slideshow.play")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goNext}>
              {t("slideshow.next")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
