import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const TRUNCATED_TEXT_TOOLTIP_DELAY_MS = 1000;

const contentStyle: React.CSSProperties = {
  textWrap: "wrap",
  width: "max-content",
  maxWidth: "20rem",
};

type TruncatedTextTooltipProps<T extends React.ElementType = "span"> = {
  text: string;
  as?: T;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  delayDuration?: number;
  contentClassName?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "title" | "children">;

export function TruncatedTextTooltip<T extends React.ElementType = "span">({
  text,
  as,
  side = "bottom",
  delayDuration = TRUNCATED_TEXT_TOOLTIP_DELAY_MS,
  className,
  contentClassName,
  children,
  ...props
}: TruncatedTextTooltipProps<T>) {
  const Tag = (as ?? "span") as React.ElementType;

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        <Tag className={className} {...props}>
          {children ?? text}
        </Tag>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn("break-all", contentClassName)}
        style={contentStyle}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
