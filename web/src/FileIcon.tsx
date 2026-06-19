import { CornerUpRight } from "lucide-react";

import { resolveFileIconUrl, type FileIconTheme } from "@/fileIcons";
import { useTranslation } from "@/i18n";
import { TruncatedTextTooltip } from "@/components/truncated-text-tooltip";
import { cn } from "@/lib/utils";

type FileIconProps = {
  name: string;
  isDir: boolean;
  isSymlink?: boolean;
  theme?: FileIconTheme;
  size?: "xs" | "sm" | "lg";
  pixelSize?: number;
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
  pixelSize,
  className,
}: FileIconProps) {
  const { t } = useTranslation();
  const iconUrl = resolveFileIconUrl({ name, isDir, theme });
  const resolvedSize = pixelSize ?? SIZE_PX[size];
  const sizeClass = pixelSize == null ? SIZE_CLASS[size] : undefined;
  const badgeScale = pixelSize == null ? size : resolvedSize <= 20 ? "xs" : resolvedSize <= 32 ? "sm" : "lg";

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <img
        className={cn(sizeClass, "shrink-0")}
        style={
          pixelSize != null
            ? { width: resolvedSize, height: resolvedSize }
            : undefined
        }
        src={iconUrl}
        alt=""
        loading="lazy"
        width={resolvedSize}
        height={resolvedSize}
      />
      {isSymlink ? (
        <TruncatedTextTooltip
          as="span"
          text={t("fileIcon.symlink")}
          className={cn(
            "absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-background text-primary ring-1 ring-border",
            BADGE_CLASS[badgeScale],
          )}
          aria-hidden
        >
          <CornerUpRight className={BADGE_ICON_CLASS[badgeScale]} strokeWidth={2.5} />
        </TruncatedTextTooltip>
      ) : null}
    </span>
  );
}
