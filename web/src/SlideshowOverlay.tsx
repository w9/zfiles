import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize,
  Music,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ZoomOneToOneIcon } from "@/components/icons/ZoomOneToOneIcon";
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
import { useModifiedTimeFormat } from "@/settings/ModifiedTimeFormatProvider";
import { cn } from "@/lib/utils";
import { useExplorerBackend, type FileStat } from "./backend";
import { useDownloadUrl } from "./useDownloadUrl";
import {
  dragExceededClickThreshold,
  panOffsetForPinch,
  panOffsetForZoomAtPoint,
  panOffsetFromDrag,
  pinchZoomScale,
  pointerDragDistance,
  scaledImageSize,
  touchPairDistance,
  touchPairMidpoint,
  type PanOffset,
} from "./slideshowPan";
import {
  isPointerOverChrome,
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
import { ZOOM_HUD_VISIBLE_MS, nextZoomHudBaseline } from "./slideshowZoomHud";
import { resolveSlideshowStartIndex } from "./slideshowPathOrder";
import { shouldClosePreviewOnBackdropClick } from "./slideshowBackdrop";
import { previewKind } from "./imagePaths";
import { previewChromeRegion } from "./previewChromeLayout";
import { fetchPreviewText, exceedsTextPreviewHardLimit, canOfferTextPreview } from "./previewTextContent";
import { renderMarkdownToSafeHtml } from "./renderMarkdown";

const CHROME_IDLE_MS = 2000;
const TOOLTIP_DELAY_MS = 1000;
// Hover zones matching the top/bottom gradient strips (h-28 = 112px, h-32 = 128px).
const CHROME_TOP_ZONE_PX = 112;
const CHROME_BOTTOM_ZONE_PX = 128;

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
  initialPan: PanOffset;
  initialMidpoint: { x: number; y: number };
};

function CenteredPreviewMessage({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-md text-center" data-preview-content>
      <p className="text-sm text-white/80">{children}</p>
    </div>
  );
}

type SlideshowOverlayProps = {
  open: boolean;
  paths: string[];
  startPath: string | null;
  honorStartPath?: boolean;
  onOpenChange: (open: boolean) => void;
  onCurrentPathChange?: (path: string) => void;
};

type ChromeLockReason = "focus" | "hover";

function useChromeAutoHide(open: boolean) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);
  const locksRef = useRef<Set<ChromeLockReason>>(new Set());

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const bumpActivity = useCallback(() => {
    setVisible(true);
    clearTimer();
    if (locksRef.current.size > 0) {
      return;
    }
    timerRef.current = window.setTimeout(() => setVisible(false), CHROME_IDLE_MS);
  }, [clearTimer]);

  const setChromeLock = useCallback(
    (reason: ChromeLockReason, locked: boolean) => {
      if (locked) {
        locksRef.current.add(reason);
        setVisible(true);
        clearTimer();
      } else {
        locksRef.current.delete(reason);
        if (locksRef.current.size === 0) {
          bumpActivity();
        }
      }
    },
    [bumpActivity, clearTimer],
  );

  useEffect(() => {
    if (!open) {
      setVisible(true);
      locksRef.current.clear();
      clearTimer();
      return;
    }
    bumpActivity();
    return clearTimer;
  }, [open, bumpActivity, clearTimer]);

  return { chromeVisible: visible, bumpActivity, setChromeLock };
}

export default function SlideshowOverlay({
  open,
  paths,
  startPath,
  honorStartPath = false,
  onOpenChange,
  onCurrentPathChange,
}: SlideshowOverlayProps) {
  const backend = useExplorerBackend();
  const { t, locale } = useTranslation();
  const { format: modifiedTimeFormat } = useModifiedTimeFormat();
  const { startAtActiveItem } = useSlideshowSettings();
  const [index, setIndex] = useState(0);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("default");
  const [manualScale, setManualScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [stat, setStat] = useState<FileStat | null>(null);
  const [statLoading, setStatLoading] = useState(false);
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textTruncated, setTextTruncated] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<"fetch_failed" | "too_large" | null>(
    null,
  );
  const [viewAsText, setViewAsText] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const pinchSessionRef = useRef<PinchSession | null>(null);
  const zoomHudBaselineRef = useRef<number | null>(null);
  const zoomHudTimerRef = useRef<number | null>(null);
  const [zoomHudVisible, setZoomHudVisible] = useState(false);
  const [zoomHudPercent, setZoomHudPercent] = useState(100);
  const [zoomHudOpaque, setZoomHudOpaque] = useState(false);
  const suppressClickRef = useRef(false);
  const { chromeVisible, bumpActivity, setChromeLock } = useChromeAutoHide(open);

  const currentPath = paths[index] ?? null;
  const canNavigate = paths.length > 1;
  const previewUrl = useDownloadUrl(backend, currentPath);
  const fileName = currentPath?.split("/").pop() ?? currentPath ?? "";
  const nativeKind = currentPath ? previewKind(currentPath) : null;
  const isImageKind = nativeKind === "image";
  const isTextKind =
    nativeKind === "text" ||
    nativeKind === "markdown" ||
    (nativeKind === null && viewAsText);
  const showUnsupported = nativeKind === null && !viewAsText;
  const fileSize = stat?.size;
  const textPreviewTooLarge =
    !statLoading && exceedsTextPreviewHardLimit(fileSize);
  const canViewAsText =
    !statLoading && canOfferTextPreview(fileSize);

  const markdownHtml = useMemo(() => {
    if (nativeKind !== "markdown" || !textContent) {
      return null;
    }
    return renderMarkdownToSafeHtml(textContent);
  }, [nativeKind, textContent]);

  const syncNaturalSizeFromVideo = useCallback((video: HTMLVideoElement) => {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      return;
    }
    setNaturalSize((prev) =>
      prev.width === video.videoWidth && prev.height === video.videoHeight
        ? prev
        : { width: video.videoWidth, height: video.videoHeight },
    );
  }, []);

  const syncNaturalSizeFromImage = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
      return;
    }
    setNaturalSize((prev) =>
      prev.width === img.naturalWidth && prev.height === img.naturalHeight
        ? prev
        : { width: img.naturalWidth, height: img.naturalHeight },
    );
  }, []);

  const resetSlideView = useCallback(() => {
    setZoomMode("default");
    setManualScale(1);
    setNaturalSize({ width: 0, height: 0 });
    setPanOffset({ x: 0, y: 0 });
    dragSessionRef.current = null;
    pinchSessionRef.current = null;
    setIsDragging(false);
    setViewAsText(false);
    setTextContent(null);
    setTextTruncated(false);
    setTextError(null);
    setTextLoading(false);
    zoomHudBaselineRef.current = null;
    if (zoomHudTimerRef.current != null) {
      window.clearTimeout(zoomHudTimerRef.current);
      zoomHudTimerRef.current = null;
    }
    setZoomHudVisible(false);
    setZoomHudOpaque(false);
  }, []);

  const clearZoomHudTimer = useCallback(() => {
    if (zoomHudTimerRef.current != null) {
      window.clearTimeout(zoomHudTimerRef.current);
      zoomHudTimerRef.current = null;
    }
  }, []);

  const revealZoomHudForScale = useCallback(
    (scale: number) => {
      const percent = formatZoomPercentage(scale);
      const next = nextZoomHudBaseline(zoomHudBaselineRef.current, percent);
      zoomHudBaselineRef.current = next.baseline;
      if (!next.reveal) {
        return;
      }
      clearZoomHudTimer();
      setZoomHudPercent(percent);
      setZoomHudVisible(true);
      setZoomHudOpaque(false);
      window.requestAnimationFrame(() => {
        setZoomHudOpaque(true);
      });
      zoomHudTimerRef.current = window.setTimeout(() => {
        setZoomHudOpaque(false);
        zoomHudTimerRef.current = window.setTimeout(() => {
          setZoomHudVisible(false);
          zoomHudTimerRef.current = null;
        }, 200);
      }, ZOOM_HUD_VISIBLE_MS);
    },
    [clearZoomHudTimer],
  );

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
    const startIndex = resolveSlideshowStartIndex(
      paths,
      startPath,
      startAtActiveItem,
      honorStartPath,
    );
    setIndex(startIndex);
    resetSlideView();
  }, [open, paths, startPath, startAtActiveItem, honorStartPath, resetSlideView]);

  useEffect(() => {
    if (!open || !currentPath) {
      return;
    }
    onCurrentPathChange?.(currentPath);
  }, [open, currentPath, onCurrentPathChange]);

  useEffect(() => {
    if (!open || !currentPath) {
      setStat(null);
      setStatLoading(false);
      return;
    }
    let cancelled = false;
    setStat(null);
    setStatLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) {
          setStatLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentPath, backend]);

  useEffect(() => {
    if (!open || !previewUrl || !isTextKind) {
      setTextContent(null);
      setTextTruncated(false);
      setTextError(null);
      setTextLoading(false);
      return;
    }
    if (statLoading) {
      setTextLoading(true);
      setTextContent(null);
      setTextTruncated(false);
      setTextError(null);
      return;
    }
    if (exceedsTextPreviewHardLimit(stat?.size)) {
      setTextLoading(false);
      setTextContent(null);
      setTextTruncated(false);
      setTextError("too_large");
      return;
    }
    let cancelled = false;
    setTextLoading(true);
    setTextContent(null);
    setTextTruncated(false);
    setTextError(null);
    void fetchPreviewText(previewUrl).then((result) => {
      if (cancelled) {
        return;
      }
      setTextLoading(false);
      if (!result.ok) {
        setTextError(result.error);
        return;
      }
      setTextContent(result.text);
      setTextTruncated(result.truncated);
    });
    return () => {
      cancelled = true;
    };
  }, [open, previewUrl, isTextKind, currentPath, statLoading, stat?.size]);

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
    if (paths.length <= 1) {
      return;
    }
    setIndex((current) => (current + 1) % paths.length);
    resetSlideView();
  }, [paths.length, resetSlideView]);

  const goPrev = useCallback(() => {
    if (paths.length <= 1) {
      return;
    }
    setIndex((current) => (current - 1 + paths.length) % paths.length);
    resetSlideView();
  }, [paths.length, resetSlideView]);

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
        if (!canNavigate) {
          return;
        }
        event.preventDefault();
        goNext();
      } else if (direction === "prev") {
        if (!canNavigate) {
          return;
        }
        event.preventDefault();
        goPrev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canNavigate, goNext, goPrev, onOpenChange, bumpActivity]);

  const imageScale = effectiveScale(zoomMode, manualScale);
  const imageSized = naturalSize.width > 0 && naturalSize.height > 0;
  const imageDisplaySize = imageSized
    ? scaledImageSize(naturalSize.width, naturalSize.height, imageScale)
    : null;

  useLayoutEffect(() => {
    if (!open || !previewUrl || !isImageKind) {
      return;
    }
    const img = imageRef.current;
    if (!img?.complete || img.naturalWidth <= 0) {
      return;
    }
    syncNaturalSizeFromImage(img);
  }, [open, previewUrl, currentPath, isImageKind, syncNaturalSizeFromImage]);

  const zoomPercent = formatZoomPercentage(imageScale);
  const grabCursor = imageSized;
  const stageCursorClass = isDragging
    ? "cursor-grabbing"
    : grabCursor
      ? "cursor-grab"
      : "cursor-default";

  useEffect(() => {
    if (!open || !isImageKind || !imageSized) {
      return;
    }
    if (zoomHudBaselineRef.current !== null) {
      return;
    }
    zoomHudBaselineRef.current = zoomPercent;
  }, [open, isImageKind, imageSized, zoomPercent]);

  useEffect(() => {
    return () => {
      if (zoomHudTimerRef.current != null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
    };
  }, []);

  const beginManualZoom = useCallback(
    (baseScale: number) => {
      setZoomMode("manual");
      setManualScale(baseScale);
      revealZoomHudForScale(baseScale);
    },
    [revealZoomHudForScale],
  );

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    bumpActivity();
    const oldScale = effectiveScale(zoomMode, manualScale);
    const newScale = wheelZoomScale(oldScale, event.deltaY);
    if (newScale === oldScale) {
      return;
    }
    const stage = stageRef.current;
    let nextPan = panOffset;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      nextPan = panOffsetForZoomAtPoint(
        panOffset,
        { x: event.clientX - centerX, y: event.clientY - centerY },
        oldScale,
        newScale,
      );
    }
    setZoomMode("manual");
    setManualScale(newScale);
    setPanOffset(nextPan);
    revealZoomHudForScale(newScale);
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

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!shouldClosePreviewOnBackdropClick(event.target)) {
      return;
    }
    onOpenChange(false);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) {
      return;
    }
    const midpoint = touchPairMidpoint(event.touches);
    if (!midpoint) {
      return;
    }
    dragSessionRef.current = null;
    setIsDragging(false);
    bumpActivity();
    const baseScale = effectiveScale(zoomMode, manualScale);
    beginManualZoom(baseScale);
    pinchSessionRef.current = {
      initialDistance: touchPairDistance(event.touches),
      initialScale: baseScale,
      initialPan: panOffset,
      initialMidpoint: midpoint,
    };
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const pinch = pinchSessionRef.current;
    if (!pinch || event.touches.length < 2) {
      return;
    }
    const midpoint = touchPairMidpoint(event.touches);
    if (!midpoint) {
      return;
    }
    event.preventDefault();
    bumpActivity();
    const nextScale = pinchZoomScale(
      pinch.initialScale,
      pinch.initialDistance,
      touchPairDistance(event.touches),
    );
    const stage = stageRef.current;
    let nextPan = pinch.initialPan;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      nextPan = panOffsetForPinch(
        pinch.initialPan,
        {
          x: pinch.initialMidpoint.x - centerX,
          y: pinch.initialMidpoint.y - centerY,
        },
        { x: midpoint.x - centerX, y: midpoint.y - centerY },
        pinch.initialScale,
        nextScale,
      );
    }
    setManualScale(nextScale);
    setPanOffset(nextPan);
    revealZoomHudForScale(nextScale);
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

  // Avoid opacity fades over the photo: Safari on iPhone re-tone-maps HDR/wide-gamut
  // images for a frame when translucent layers animate opacity.
  const chromeMotionClass = cn(
    "pointer-events-auto transition-transform duration-300 ease-out",
    !chromeVisible && "pointer-events-none",
  );
  const chromeTopClass = cn(chromeMotionClass, !chromeVisible && "-translate-y-full");
  const chromeBottomClass = cn(
    chromeMotionClass,
    !chromeVisible && "translate-y-full",
  );
  const chromeLeftClass = cn(
    chromeMotionClass,
    // Element-relative -translate-x-full leaves a strip visible (left-3 + button width).
    !chromeVisible && "-translate-x-[calc(100%+1.5rem)]",
  );
  const chromeRightClass = cn(
    chromeMotionClass,
    !chromeVisible && "translate-x-[calc(100%+1.5rem)]",
  );
  const chromeGradientClass = cn(
    "pointer-events-none",
    !chromeVisible && "invisible",
  );

  const overlay = (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t("slideshow.title", { name: fileName })}
      onMouseMove={(event) => {
        setChromeLock(
          "hover",
          isPointerOverChrome(
            event.clientY,
            window.innerHeight,
            CHROME_TOP_ZONE_PX,
            CHROME_BOTTOM_ZONE_PX,
          ),
        );
        bumpActivity();
      }}
      onMouseLeave={() => {
        setChromeLock("hover", false);
      }}
      onFocus={(event) => {
        if (isSlideshowTypingTarget(event.target)) {
          setChromeLock("focus", true);
        }
      }}
      onBlur={(event) => {
        if (isSlideshowTypingTarget(event.target)) {
          setChromeLock("focus", false);
        }
      }}
    >
      <div className="absolute inset-0 bg-black/80" aria-hidden />

      {zoomHudVisible ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            className={cn(
              "rounded-md bg-black/60 px-4 py-2 text-2xl font-medium tabular-nums text-white drop-shadow-sm transition-opacity duration-200",
              zoomHudOpaque ? "opacity-100" : "opacity-0",
            )}
          >
            {t("slideshow.zoomLevel", { percent: String(zoomHudPercent) })}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 via-black/20 to-transparent",
          chromeGradientClass,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 via-black/20 to-transparent",
          chromeGradientClass,
        )}
        aria-hidden
      />

      <div
        ref={viewportRef}
        className={cn("absolute inset-0 overflow-hidden", isImageKind && "touch-none")}
        onClick={handleBackdropClick}
        onWheel={isImageKind ? handleWheel : undefined}
        onTouchStart={isImageKind ? handleTouchStart : undefined}
        onTouchMove={isImageKind ? handleTouchMove : undefined}
        onTouchEnd={isImageKind ? handleTouchEnd : undefined}
        onTouchCancel={isImageKind ? handleTouchEnd : undefined}
      >
        <div className="flex h-full w-full items-center justify-center p-6">
          {!previewUrl ? (
            <p className="text-sm text-white/80">{t("preview.loading")}</p>
          ) : isImageKind ? (
            <div
              ref={stageRef}
              className={cn("touch-none select-none isolate", stageCursorClass)}
              data-preview-content
              style={{ transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)` }}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={endStagePointer}
              onPointerCancel={endStagePointer}
              onClickCapture={handleStageClick}
            >
              <img
                key={currentPath}
                ref={imageRef}
                src={previewUrl}
                alt={fileName}
                draggable={false}
                className="max-w-none select-none"
                style={{
                  width: imageDisplaySize?.width,
                  height: imageDisplaySize?.height,
                  opacity: imageSized ? 1 : 0,
                }}
                onLoad={(event) => {
                  syncNaturalSizeFromImage(event.currentTarget);
                }}
              />
            </div>
          ) : nativeKind === "video" ? (
            <video
              key={currentPath}
              src={previewUrl}
              controls
              autoPlay={false}
              className="max-h-full max-w-full"
              aria-label={fileName}
              data-preview-content
              onLoadedMetadata={(event) => {
                syncNaturalSizeFromVideo(event.currentTarget);
              }}
            />
          ) : nativeKind === "audio" ? (
            <div className="flex flex-col items-center gap-4" data-preview-content>
              <Music className="h-16 w-16 text-white/70" aria-hidden />
              <audio
                key={currentPath}
                src={previewUrl}
                controls
                aria-label={fileName}
                className="w-[min(80vw,28rem)]"
              />
            </div>
          ) : nativeKind === "pdf" ? (
            <div className="flex h-full w-full max-w-6xl flex-col" data-preview-content>
              <iframe
                key={currentPath}
                src={previewUrl}
                title={fileName}
                className="min-h-0 flex-1 w-full rounded-sm bg-white"
              />
            </div>
          ) : showUnsupported ? (
            statLoading ? (
              <CenteredPreviewMessage>{t("preview.loading")}</CenteredPreviewMessage>
            ) : textPreviewTooLarge ? (
              <CenteredPreviewMessage>{t("preview.textTooLarge")}</CenteredPreviewMessage>
            ) : canViewAsText ? (
              <div
                className="flex max-w-md flex-col items-center gap-4 text-center"
                data-preview-content
              >
                <p className="text-sm text-white/80">{t("preview.noPreview")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-black/50 text-white hover:bg-black/70"
                  onClick={() => {
                    bumpActivity();
                    setViewAsText(true);
                  }}
                >
                  {t("preview.viewAsText")}
                </Button>
              </div>
            ) : null
          ) : isTextKind ? (
            <div className="flex h-full w-full max-w-5xl flex-col" data-preview-content>
              {textPreviewTooLarge || textError === "too_large" ? (
                <CenteredPreviewMessage>{t("preview.textTooLarge")}</CenteredPreviewMessage>
              ) : textLoading ? (
                <CenteredPreviewMessage>{t("preview.loading")}</CenteredPreviewMessage>
              ) : textError === "fetch_failed" ? (
                <CenteredPreviewMessage>{t("preview.textLoadError")}</CenteredPreviewMessage>
              ) : nativeKind === "markdown" && markdownHtml ? (
                <>
                  {textTruncated ? (
                    <p className="mb-2 shrink-0 text-xs text-amber-200/90">
                      {t("preview.textTruncated")}
                    </p>
                  ) : null}
                  <div
                    className="min-h-0 flex-1 overflow-auto rounded-lg bg-zinc-900/80 p-6 text-left text-sm leading-relaxed text-white/90 [&_a]:text-sky-300 [&_a]:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:my-2 [&_ol]:list-decimal [&_p]:mb-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-black/40 [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: markdownHtml }}
                  />
                </>
              ) : textContent != null ? (
                <>
                  {textTruncated ? (
                    <p className="mb-2 shrink-0 text-xs text-amber-200/90">
                      {t("preview.textTruncated")}
                    </p>
                  ) : null}
                  <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-black/40 p-4 text-left font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-white/90">
                    {textContent}
                  </pre>
                </>
              ) : (
                <CenteredPreviewMessage>{t("preview.loading")}</CenteredPreviewMessage>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn("absolute inset-x-0 top-0 w-full p-4", chromeTopClass)}
        data-preview-chrome={previewChromeRegion("title")}
      >
        <div className="flex w-full flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-white drop-shadow-sm">
            {fileName}
            {paths.length > 1 ? (
              <span
                className="ml-2 text-white/75 tabular-nums"
                aria-label={t("slideshow.counter", {
                  current: String(index + 1),
                  total: String(paths.length),
                })}
              >
                {t("slideshow.counter", {
                  current: String(index + 1),
                  total: String(paths.length),
                })}
              </span>
            ) : null}
          </p>
          <p
            className="truncate text-xs text-white/90 drop-shadow-sm"
            data-preview-chrome={previewChromeRegion("metadata")}
          >
            {metadataLine || "—"}
          </p>
        </div>
      </div>

      {canNavigate ? (
        <>
          <div
            className={cn(
              "absolute top-1/2 left-3 z-10 -translate-y-1/2",
              chromeLeftClass,
            )}
            aria-hidden={!chromeVisible}
          >
            <SlideshowIconTooltip label={t("slideshow.previous")}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 bg-black/50 text-white hover:bg-black/70"
                aria-label={t("slideshow.previous")}
                onClick={() => {
                  bumpActivity();
                  goPrev();
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </SlideshowIconTooltip>
          </div>
          <div
            className={cn(
              "absolute top-1/2 right-3 z-10 -translate-y-1/2",
              chromeRightClass,
            )}
            aria-hidden={!chromeVisible}
          >
            <SlideshowIconTooltip label={t("slideshow.next")}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 bg-black/50 text-white hover:bg-black/70"
                aria-label={t("slideshow.next")}
                onClick={() => {
                  bumpActivity();
                  goNext();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </SlideshowIconTooltip>
          </div>
        </>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex w-full flex-wrap items-end justify-end gap-2 p-4",
          chromeBottomClass,
        )}
        data-preview-chrome={previewChromeRegion("actions")}
      >
        {isImageKind ? (
          <ButtonGroup
            aria-label={t("slideshow.zoomLevel", { percent: String(zoomPercent) })}
            data-preview-chrome={previewChromeRegion("zoom")}
          >
            <SlideshowIconTooltip label={t("slideshow.zoomFit")}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 border border-white/15 bg-black/50 text-white hover:bg-black/70 touch-ui:h-11 touch-ui:w-11"
                aria-label={t("slideshow.zoomFit")}
                onClick={() => {
                  bumpActivity();
                  setZoomMode("fit");
                  setPanOffset({ x: 0, y: 0 });
                  revealZoomHudForScale(effectiveScale("fit", manualScale));
                }}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
            <SlideshowIconTooltip label={t("slideshow.zoomActual")}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 border border-white/15 bg-black/50 text-white hover:bg-black/70 touch-ui:h-11 touch-ui:w-11"
                aria-label={t("slideshow.zoomActual")}
                onClick={() => {
                  bumpActivity();
                  setZoomMode("one-to-one");
                  revealZoomHudForScale(effectiveScale("one-to-one", manualScale));
                }}
              >
                <ZoomOneToOneIcon className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
            <SlideshowIconTooltip label={t("slideshow.zoomOut")}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 border border-white/15 bg-black/50 text-white hover:bg-black/70 touch-ui:h-11 touch-ui:w-11"
                aria-label={t("slideshow.zoomOut")}
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
            <SlideshowIconTooltip label={t("slideshow.zoomIn")}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 border border-white/15 bg-black/50 text-white hover:bg-black/70 touch-ui:h-11 touch-ui:w-11"
                aria-label={t("slideshow.zoomIn")}
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </SlideshowIconTooltip>
          </ButtonGroup>
        ) : null}
        {previewUrl ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-black/50 text-white hover:bg-black/70"
              asChild
            >
              <a href={previewUrl} download={fileName}>
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
                window.open(previewUrl, "_blank", "noopener,noreferrer");
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
  );

  return createPortal(overlay, document.body);
}
