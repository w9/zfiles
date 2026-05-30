import { Link2 } from "lucide-react";

import { resolveFileIconUrl, type FileIconTheme } from "@/fileIcons";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

type FileIconProps = {
  name: string;
  isDir: boolean;
  isSymlink?: boolean;
  theme?: FileIconTheme;
  size?: "sm" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-6 w-6",
  lg: "h-10 w-10",
} as const;

const BADGE_CLASS = {
  sm: "h-3 w-3",
  lg: "h-4 w-4",
} as const;

const BADGE_ICON_CLASS = {
  sm: "h-2 w-2",
  lg: "h-2.5 w-2.5",
} as const;

export function FileIcon({
  name,
  isDir,
  isSymlink = false,
  theme = "dark",
  size = "sm",
  className,
}: FileIconProps) {
  const { t } = useTranslation();
  const iconUrl = resolveFileIconUrl({ name, isDir, theme });

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <img
        className={cn(SIZE_CLASS[size], "shrink-0")}
        src={iconUrl}
        alt=""
        loading="lazy"
        width={size === "lg" ? 40 : 24}
        height={size === "lg" ? 40 : 24}
      />
      {isSymlink ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-background text-primary ring-1 ring-border",
            BADGE_CLASS[size],
          )}
          title={t("fileIcon.symlink")}
          aria-hidden
        >
          <Link2 className={BADGE_ICON_CLASS[size]} strokeWidth={2.5} />
        </span>
      ) : null}
    </span>
  );
}
