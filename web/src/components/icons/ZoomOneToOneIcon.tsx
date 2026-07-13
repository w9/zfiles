import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** One-to-one (1:1) zoom icon — cleaned from the Graphite export. */
export function ZoomOneToOneIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden="true"
      {...props}
    >
      {/* Left "1" */}
      <path d="M5 17V5l-3 2" />
      {/* Colon */}
      <path d="M12 10h.01" />
      <path d="M12 15h.01" />
      {/* Right "1" */}
      <path d="M20 17V5l-3 2" />
    </svg>
  );
}
