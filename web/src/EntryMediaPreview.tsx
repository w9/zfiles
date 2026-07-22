import { memo, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

import { FileIcon } from "@/FileIcon";
import { useExplorerBackend } from "@/backend";
import {
  canEntryMediaPreviewImage,
  canEntryMediaPreviewVideo,
  entryMediaVideoChrome,
  type EntryMediaPreviewSurface,
} from "@/mediaPreviewPolicy";
import {
  GRID_CARD_MEDIA_OBJECT_CLASS,
  GRID_CARD_MEDIA_SHELL_CLASS,
} from "@/explorer/gridCardMediaLayout";
import type { FileIconTheme } from "@/fileIcons";
import { cn } from "@/lib/utils";
import { useGridThumbnailBadge } from "@/settings/GridThumbnailBadgeProvider";
import { useDownloadUrl } from "@/useDownloadUrl";
import { useInView } from "@/useInView";
import { formatVideoDuration } from "@/videoDuration";

const LIST_MEDIA_SHELL_CLASS =
  "relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden";
const LIST_MEDIA_OBJECT_CLASS = "h-full w-full object-cover";

type EntryMediaPreviewProps = {
  path: string;
  name: string;
  isDir: boolean;
  isSymlink: boolean;
  previewsEnabled: boolean;
  iconTheme: FileIconTheme;
  pixelSize: number;
  surface?: EntryMediaPreviewSurface;
};

function EntryMediaPreview({
  path,
  name,
  isDir,
  isSymlink,
  previewsEnabled,
  iconTheme,
  pixelSize,
  surface = "grid",
}: EntryMediaPreviewProps) {
  const backend = useExplorerBackend();
  const { enabled: thumbnailBadgeEnabled } = useGridThumbnailBadge();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const canPreviewImage = canEntryMediaPreviewImage(name, isDir, previewsEnabled);
  const canPreviewVideo = canEntryMediaPreviewVideo(name, isDir, previewsEnabled);
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

  const videoChrome = entryMediaVideoChrome(surface, {
    badgeEnabled: thumbnailBadgeEnabled,
    showVideoPreview,
    loaded,
    failed,
  });

  const shellClass =
    surface === "list" ? LIST_MEDIA_SHELL_CLASS : GRID_CARD_MEDIA_SHELL_CLASS;
  const objectClass =
    surface === "list" ? LIST_MEDIA_OBJECT_CLASS : GRID_CARD_MEDIA_OBJECT_CLASS;

  return (
    <div ref={containerRef} className={shellClass}>
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
            objectClass,
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
            "pointer-events-none",
            objectClass,
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
      {videoChrome.showPlay ? (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center",
              surface === "list" && "bg-black/35",
            )}
          >
            {surface === "list" ? (
              <Play className="size-2 fill-current text-white/90" />
            ) : (
              <div className="flex size-7 items-center justify-center rounded-full bg-black/40 text-white/80">
                <Play className="size-3.5 fill-current" />
              </div>
            )}
          </div>
          {videoChrome.showDuration && durationLabel ? (
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/50 px-1 py-0.5 text-xs leading-none text-white/70 tabular-nums"
            >
              {durationLabel}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default memo(EntryMediaPreview);
