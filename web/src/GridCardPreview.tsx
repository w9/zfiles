import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

import { FileIcon } from "@/FileIcon";
import { useExplorerBackend } from "@/backend";
import type { FileIconTheme } from "@/fileIcons";
import { isBrowserPreviewImage, isBrowserPreviewVideo } from "@/imagePaths";
import { cn } from "@/lib/utils";
import { useGridThumbnailBadge } from "@/settings/GridThumbnailBadgeProvider";
import { useDownloadUrl } from "@/useDownloadUrl";
import { useInView } from "@/useInView";
import { formatVideoDuration } from "@/videoDuration";

type GridCardPreviewProps = {
  path: string;
  name: string;
  isDir: boolean;
  isSymlink: boolean;
  previewsEnabled: boolean;
  iconTheme: FileIconTheme;
  pixelSize: number;
};

export default function GridCardPreview({
  path,
  name,
  isDir,
  isSymlink,
  previewsEnabled,
  iconTheme,
  pixelSize,
}: GridCardPreviewProps) {
  const backend = useExplorerBackend();
  const { enabled: thumbnailBadgeEnabled } = useGridThumbnailBadge();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const canPreviewImage = previewsEnabled && !isDir && isBrowserPreviewImage(name);
  const canPreviewVideo = previewsEnabled && !isDir && isBrowserPreviewVideo(name);
  const showImagePreview = canPreviewImage;
  const showVideoPreview = canPreviewVideo && inView;
  const wantsPreviewUrl = showImagePreview || showVideoPreview;
  const downloadUrl = useDownloadUrl(backend, wantsPreviewUrl ? path : null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [durationLabel, setDurationLabel] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setDurationLabel(null);
  }, [path, showVideoPreview]);

  const showIcon =
    (!showImagePreview && !showVideoPreview) ||
    !downloadUrl ||
    failed ||
    !loaded;

  const showVideoChrome =
    thumbnailBadgeEnabled && showVideoPreview && loaded && !failed;

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 items-center justify-center p-2"
    >
      {showIcon ? (
        <FileIcon
          name={name}
          isDir={isDir}
          isSymlink={isSymlink}
          theme={iconTheme}
          pixelSize={pixelSize}
        />
      ) : null}
      {showImagePreview && downloadUrl && !failed ? (
        <img
          src={downloadUrl}
          alt=""
          draggable={false}
          loading="lazy"
          fetchPriority={inView ? "high" : "low"}
          className={cn(
            "max-h-full max-w-full object-contain",
            loaded ? "opacity-100" : "pointer-events-none absolute opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onDragStart={(event) => event.preventDefault()}
        />
      ) : null}
      {showVideoPreview && downloadUrl && !failed ? (
        <video
          src={downloadUrl}
          preload="metadata"
          muted
          playsInline
          draggable={false}
          className={cn(
            "pointer-events-none max-h-full max-w-full object-contain",
            loaded ? "opacity-100" : "absolute opacity-0",
          )}
          onLoadedData={(event) => {
            setLoaded(true);
            setDurationLabel(formatVideoDuration(event.currentTarget.duration));
          }}
          onError={() => setFailed(true)}
          onDragStart={(event) => event.preventDefault()}
        />
      ) : null}
      {showVideoChrome ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white/80">
              <Play className="size-4 fill-current" />
            </div>
          </div>
          {durationLabel ? (
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/50 px-1 py-0.5 text-[10px] leading-none text-white/70 tabular-nums"
            >
              {durationLabel}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
