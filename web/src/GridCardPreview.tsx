import { useEffect, useRef, useState } from "react";

import { FileIcon } from "@/FileIcon";
import { useExplorerBackend } from "@/backend";
import type { FileIconTheme } from "@/fileIcons";
import { isBrowserPreviewImage } from "@/imagePaths";
import { cn } from "@/lib/utils";
import { useDownloadUrl } from "@/useDownloadUrl";
import { useInView } from "@/useInView";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const showThumbnail = previewsEnabled && !isDir && isBrowserPreviewImage(name);
  const downloadUrl = useDownloadUrl(backend, showThumbnail ? path : null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [path]);

  const showIcon = !showThumbnail || !downloadUrl || failed || !loaded;

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-2"
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
      {showThumbnail && downloadUrl && !failed ? (
        <img
          src={downloadUrl}
          alt=""
          loading="lazy"
          fetchPriority={inView ? "high" : "low"}
          className={cn(
            "max-h-full max-w-full object-contain",
            loaded ? "opacity-100" : "pointer-events-none absolute opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
