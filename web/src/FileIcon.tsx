import { resolveFileIconUrl, type FileIconTheme } from "@/fileIcons";
import { cn } from "@/lib/utils";

type FileIconProps = {
  name: string;
  isDir: boolean;
  thumbnailUrl?: string;
  theme?: FileIconTheme;
  atListingRoot?: boolean;
  size?: "sm" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-7 w-7",
  lg: "h-12 w-12",
} as const;

export function FileIcon({
  name,
  isDir,
  thumbnailUrl,
  theme = "dark",
  atListingRoot = false,
  size = "sm",
  className,
}: FileIconProps) {
  if (thumbnailUrl) {
    return (
      <img
        className={cn(
          SIZE_CLASS[size],
          "shrink-0 rounded object-cover",
          className,
        )}
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        width={size === "lg" ? 48 : 28}
        height={size === "lg" ? 48 : 28}
      />
    );
  }

  const iconUrl = resolveFileIconUrl({ name, isDir, theme, atListingRoot });

  return (
    <img
      className={cn(SIZE_CLASS[size], "shrink-0", className)}
      src={iconUrl}
      alt=""
      loading="lazy"
      width={size === "lg" ? 48 : 28}
      height={size === "lg" ? 48 : 28}
    />
  );
}
