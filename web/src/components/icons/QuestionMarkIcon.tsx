import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export function QuestionMarkIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
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
      <path d="M 6 9 C 6 9 5.468 6.054 7.325 4.462 C 8.432 3.513 10.104 3 12 3 C 15 3 18 3.858 18 8.142 C 18 11.572 15 10.714 13 12.428 C 11.624 13.608 11.999 15.001 12 15" />
      <path d="M 11.99 21 L 12 19" />
    </svg>
  );
}
