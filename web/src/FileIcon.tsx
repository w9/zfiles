import { resolveFileIconUrl, type FileIconTheme } from "@/fileIcons";
import { cn } from "@/lib/utils";

type FileIconProps = {
  name: string;
  isDir: boolean;
  theme?: FileIconTheme;
  size?: "sm" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-6 w-6",
  lg: "h-10 w-10",
} as const;

export function FileIcon({
  name,
  isDir,
  theme = "dark",
  size = "sm",
  className,
}: FileIconProps) {
  const iconUrl = resolveFileIconUrl({ name, isDir, theme });

  return (
    <img
      className={cn(SIZE_CLASS[size], "shrink-0", className)}
      src={iconUrl}
      alt=""
      loading="lazy"
      width={size === "lg" ? 40 : 24}
      height={size === "lg" ? 40 : 24}
    />
  );
}
