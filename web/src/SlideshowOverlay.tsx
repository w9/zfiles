import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  Download,
  ExternalLink,
  Maximize2,
  Pause,
  Play,
  Scan,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import { formatSize } from "./listing-format";
import {
  cloudExtraString,
  formatKindLabel,
  formatPreviewModified,
} from "./preview-metadata";
import { useSlideshowSettings } from "@/settings/SlideshowSettingsProvider";
import {
  SLIDESHOW_INTERVAL_MAX,
  SLIDESHOW_INTERVAL_MIN,
  clampSlideshowInterval,
} from "@/settings/slideshowSettings";
import { useModifiedTimeFormat } from "@/settings/ModifiedTimeFormatProvider";
import { cn } from "@/lib/utils";
import { useExplorerBackend, type FileStat } from "./backend";
import { useDownloadUrl } from "./useDownloadUrl";
import {
  dragExceededClickThreshold,
  imageOverflowsViewport,
  panOffsetFromDrag,
  pinchZoomScale,
  pointerDragDistance,
  showGrabCursor,
  touchPairDistance,
  type PanOffset,
} from "./slideshowPan";
import {
  isSlideshowTypingTarget,
  slideshowNavDirection,
} from "./slideshowNavigation";
import {
  formatZoomPercentage,
  resolveImageScale,
  stepZoom,
  wheelZoomScale,
  type ZoomMode,
} from "./slideshowZoom";

const CHROME_IDLE_MS = 2000;
const TOOLTIP_DELAY_MS = 1000;

function SlideshowIconTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

type DragSession = {
  pointerId: number;
  startPointer: { x: number; y: number };
  startPan: PanOffset;
  moved: boolean;
};

type PinchSession = {
  initialDistance: number;
  initialScale: number;
};

type SlideshowOverlayProps = {
  open: boolean;
  paths: string[];
  startPath: string | null;
  onOpenChange: (open: boolean) => void;
};

function useChromeAutoHide(open: boolean) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  const bumpActivity = useCallback(() => {
    setVisible(true);
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setVisible(false), CHROME_IDLE_MS);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(true);
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    bumpActivity();
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [open, bumpActivity]);

  return { chromeVisible: visible, bumpActivity };
}

export default function SlideshowOverlay({
  open,
  paths,
  startPath,
  onOpenChange,
}: SlideshowOverlayProps) {
  const backend = useExplorerBackend();
  const { t, locale } = useTranslation();
  const { format: modifiedTimeFormat } = useModifiedTimeFormat();
  const { autoplayOnOpen, intervalSeconds, setIntervalSeconds } = useSlideshowSettings();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("default");
  const [manualScale, setManualScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [stat, setStat] = useState<FileStat | null>(null);
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const pinchSessionRef = useRef<PinchSession | null>(null);
  const suppressClickRef = useRef(false);
  const { chromeVisible, bumpActivity } = useChromeAutoHide(open);

  const currentPath = paths[index] ?? null;
  const imageUrl = useDownloadUrl(backend, currentPath);
  const fileName = currentPath?.split("/").pop() ?? currentPath ?? "";

  const resetSlideView = useCallback(() => {
    setZoomMode("default");
    setManualScale(1);
    setNaturalSize({ width: 0, height: 0 });
    setPanOffset({ x: 0, y: 0 });
    dragSessionRef.current = null;
    pinchSessionRef.current = null;
    setIsDragging(false);
  }, []);

  const effectiveScale = useCallback(
    (mode: ZoomMode, manual: number) =>
      resolveImageScale(
        mode,
        manual,
        naturalSize.width,
        naturalSize.height,
        viewportSize.width,
        viewportSize.height,
      ),
    [naturalSize.height, naturalSize.width, viewportSize.height, viewportSize.width],
  );

  useEffect(() => {
    if (!open || paths.length === 0) {
      return;
    }
    const startIndex = startPath ? Math.max(0, paths.indexOf(startPath)) : 0;
    setIndex(startIndex >= 0 ? startIndex : 0);
    setPlaying(autoplayOnOpen);
    resetSlideView();
  }, [open, paths, startPath, autoplayOnOpen, resetSlideView]);

  useEffect(() => {
    if (!open || !currentPath) {
      setStat(null);
      return;
    }
    let cancelled = false;
    setStat(null);
    void backend
      .stat(currentPath)
      .then((data) => {
        if (!cancelled) {
          setStat(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStat(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentPath, backend]);

  useEffect(() => {
    if (!open || !viewportRef.current) {
      return;
    }
    const element = viewportRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const goNext = useCallback(() => {
    setIndex((current) => (current + 1) % paths.length);
    resetSlideView();
  }, [paths.length, resetSlideView]);

  const goPrev = useCallback(() => {
    setIndex((current) => (current - 1 + paths.length) % paths.length);
    resetSlideView();
  }, [paths.length, resetSlideView]);

  useEffect(() => {
    if (!open || !playing || paths.length <= 1) {
      return;
    }
    const handle = window.setInterval(goNext, intervalSeconds * 1000);
    return () => window.clearInterval(handle);
  }, [open, playing, paths.length, goNext, intervalSeconds]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSlideshowTypingTarget(event.target)) {
        return;
      }
      bumpActivity();
      const direction = slideshowNavDirection(event.key);
      if (direction === "next") {
        event.preventDefault();
        goNext();
      } else if (direction === "prev") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, goNext, goPrev, onOpenChange, bumpActivity]);

  const imageScale = effectiveScale(zoomMode, manualScale);
  const zoomPercent = formatZoomPercentage(imageScale);
  const imageOverflows = imageOverflowsViewport(
    naturalSize.width,
    naturalSize.height,
    imageScale,
    viewportSize.width,
    viewportSize.height,
  );
  const grabCursor = showGrabCursor(imageOverflows, panOffset);
  const stageCursorClass = isDragging
    ? "cursor-grabbing"
    : grabCursor
      ? "cursor-grab"
      : "cursor-default";

  const beginManualZoom = useCallback(
    (baseScale: number) => {
      setZoomMode("manual");
      setManualScale(baseScale);
    },
    [],
  );

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    bumpActivity();
    beginManualZoom(wheelZoomScale(effectiveScale(zoomMode, manualScale), event.deltaY));
  };

  const handleZoomIn = () => {
    bumpActivity();
    beginManualZoom(stepZoom(effectiveScale(zoomMode, manualScale), 1));
  };

  const handleZoomOut = () => {
    bumpActivity();
    beginManualZoom(stepZoom(effectiveScale(zoomMode, manualScale), -1));
  };

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pinchSessionRef.current) {
      return;
    }
    bumpActivity();
    setPlaying(false);
    const session: DragSession = {
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPan: panOffset,
      moved: false,
    };
    dragSessionRef.current = session;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    const currentPointer = { x: event.clientX, y: event.clientY };
    const distance = pointerDragDistance(session.startPointer, currentPointer);
    if (dragExceededClickThreshold(distance)) {
      session.moved = true;
      bumpActivity();
    }
    setPanOffset(panOffsetFromDrag(session.startPan, session.startPointer, currentPointer));
  };

  const endStagePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    if (session.moved) {
      suppressClickRef.current = true;
    }
    dragSessionRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) {
      return;
    }
    dragSessionRef.current = null;
    setIsDragging(false);
    bumpActivity();
    setPlaying(false);
    const baseScale = effectiveScale(zoomMode, manualScale);
    beginManualZoom(baseScale);
    pinchSessionRef.current = {
      initialDistance: touchPairDistance(event.touches),
      initialScale: baseScale,
    };
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = pinchSessionRef.current;
    if (!pinch || event.touches.length < 2) {
      return;
    }
    event.preventDefault();
    bumpActivity();
    setManualScale(
      pinchZoomScale(
        pinch.initialScale,
        pinch.initialDistance,
        touchPairDistance(event.touches),
      ),
    );
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchSessionRef.current = null;
    }
  };

  if (!open || !currentPath) {
    return null;
  }

  const contentType = stat ? cloudExtraString(stat.extra, "contentType") : null;
  const kindLabel =
    stat &&
    formatKindLabel({
      isDir: stat.is_dir,
      path: stat.path,
      contentType,
      labels: {
        folder: t("preview.kind.folder"),
        noExtension: t("preview.kind.noExtension"),
      },
    });
  const modifiedLabel =
    stat && formatPreviewModified(stat.modified, locale, modifiedTimeFormat);
  const sizeLabel = stat ? formatSize(stat.size, false) : "—";
  const dimensionsLabel =
    naturalSize.width > 0 && naturalSize.height > 0
      ? t("slideshow.dimensions", {
          width: String(naturalSize.width),
          height: String(naturalSize.height),
        })
      : null;
  const metadataLine = [dimensionsLabel, sizeLabel, modifiedLabel, kindLabel]
    .filter((part): part is string => Boolean(part && part !== "—"))
    .join(" · ");

  const chromeClass = cn(
    "pointer-events-auto transition-opacity duration-300",
    chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
  );

  const overlay = (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t("slideshow.title", { name: fileName })}
      onMouseMove={bumpActivity}
    >
      <div className="absolute inset-0 bg-black/80" aria-hidden />

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 via-black/20 to-transparent",
          chromeClass,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 via-black/20 to-transparent",
          chromeClass,
        )}
        aria-hidden
      />

      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none overflow-hidden"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="flex h-full w-full items-center justify-center p-6">
          {imageUrl ? (
            <div
              className={cn("touch-none select-none", stageCursorClass)}
              style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={endStagePointer}
              onPointerCancel={endStagePointer}
              onClickCapture={handleStageClick}
            >
              <img
                src={imageUrl}
                alt={fileName}
                draggable={false}
                className="max-w-none select-none"
                style={{
                  width: naturalSize.width > 0 ? naturalSize.width : undefined,
                  height: naturalSize.height > 0 ? naturalSize.height : undefined,
                  transform: `scale(${imageScale})`,
                  transformOrigin: "center center",
                }}
                onLoad={(event) => {
                  const img = event.currentTarget;
                  setNaturalSize({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-white/80">{t("preview.loading")}</p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4",
          chromeClass,
        )}
      >
        <p className="max-w-[min(50vw,32rem)] truncate text-sm font-medium text-white drop-shadow-sm">
          {fileName}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className="self-center px-0.5 text-xs tabular-nums text-white/90 drop-shadow-sm"
            aria-label={t("slideshow.zoomLevel", { percent: String(zoomPercent) })}
          >
            {t("slideshow.zoomLevel", { percent: String(zoomPercent) })}
          </span>
          <div className="flex items-center gap-1 rounded-md bg-black/50 p-1 backdrop-blur-sm">
            <SlideshowIconTooltip label={t("slideshow.zoomFit")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                aria-label={t("slideshow.zoomFit")}
                onClick={() => {
                  bumpActivity();
                  setZoomMode("fit");
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
            <SlideshowIconTooltip label={t("slideshow.zoomActual")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                aria-label={t("slideshow.zoomActual")}
                onClick={() => {
                  bumpActivity();
                  setZoomMode("one-to-one");
                }}
              >
                <Scan className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
            <SlideshowIconTooltip label={t("slideshow.zoomOut")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                aria-label={t("slideshow.zoomOut")}
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
            <SlideshowIconTooltip label={t("slideshow.zoomIn")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                aria-label={t("slideshow.zoomIn")}
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-black/50 p-1 backdrop-blur-sm">
            <SlideshowIconTooltip
              label={playing ? t("slideshow.pause") : t("slideshow.play")}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                aria-label={playing ? t("slideshow.pause") : t("slideshow.play")}
                onClick={() => {
                  bumpActivity();
                  setPlaying((value) => !value);
                }}
                disabled={paths.length <= 1}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </SlideshowIconTooltip>
            <label className="flex items-center gap-1.5 text-xs text-white/90">
              <span className="sr-only">{t("slideshow.interval")}</span>
              <Input
                type="number"
                min={SLIDESHOW_INTERVAL_MIN}
                max={SLIDESHOW_INTERVAL_MAX}
                value={intervalSeconds}
                onChange={(event) => {
                  bumpActivity();
                  const parsed = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(parsed)) {
                    setIntervalSeconds(parsed);
                  }
                }}
                onBlur={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  setIntervalSeconds(
                    Number.isFinite(parsed)
                      ? parsed
                      : clampSlideshowInterval(intervalSeconds),
                  );
                }}
                className="h-8 w-16 border-white/20 bg-black/40 text-white"
              />
              <span aria-hidden>s</span>
            </label>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4",
          chromeClass,
        )}
      >
        <p className="max-w-[min(70vw,48rem)] truncate text-xs text-white/90 drop-shadow-sm">
          {metadataLine || "—"}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {imageUrl ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-black/50 text-white hover:bg-black/70"
                asChild
              >
                <a href={imageUrl} download={fileName}>
                  <Download className="h-4 w-4" />
                  {t("slideshow.download")}
                </a>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-black/50 text-white hover:bg-black/70"
                onClick={() => {
                  bumpActivity();
                  window.open(imageUrl, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="h-4 w-4" />
                {t("slideshow.openInNewTab")}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="bg-black/50 text-white hover:bg-black/70"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            {t("slideshow.close")}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
