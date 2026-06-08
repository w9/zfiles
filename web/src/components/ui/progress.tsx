import * as React from "react";

import { cn } from "@/lib/utils";

export type ProgressVariant = "upload" | "local";

const progressVariantClasses: Record<
  ProgressVariant,
  { track: string; indicator: string }
> = {
  upload: {
    track: "bg-primary/20",
    indicator: "bg-primary",
  },
  local: {
    track: "bg-muted-foreground/25",
    indicator: "bg-muted-foreground",
  },
};

type ProgressProps = React.ComponentProps<"div"> & {
  value?: number;
  max?: number;
  variant?: ProgressVariant;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = "upload", ...props }, ref) => {
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    const colors = progressVariantClasses[variant];
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full",
          colors.track,
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full transition-[width] duration-150 ease-out",
            colors.indicator,
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
