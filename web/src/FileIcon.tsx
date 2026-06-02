import { CornerUpRight } from "lucide-react";

import { resolveFileIconUrl, type FileIconTheme } from "@/fileIcons";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

type FileIconProps = {
  name: string;
  isDir: boolean;
  isSymlink?: boolean;
  theme?: FileIconTheme;
  size?: "xs" | "sm" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  xs: "h-4 w-4",
  sm: "h-6 w-6",
  lg: "h-10 w-10",
} as const;

const BADGE_CLASS = {
  xs: "h-2.5 w-2.5",
  sm: "h-3 w-3",
  lg: "h-4 w-4",
} as const;

const BADGE_ICON_CLASS = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  lg: "h-2.5 w-2.5",
} as const;

const SIZE_PX = {
  xs: 16,
  sm: 24,
  lg: 40,
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
        width={SIZE_PX[size]}
        height={SIZE_PX[size]}
      />
      {isSymlink ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-background text-primary ring-1 ring-border",
            BADGE_CLASS[size],
          )}
          title={t("fileIcon.symlink")}
          aria-hidden
        >
          <CornerUpRight className={BADGE_ICON_CLASS[size]} strokeWidth={2.5} />
        </span>
      ) : null}
    </span>
  );
}
