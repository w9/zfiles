import { useEffect, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type InlineNameInputProps = {
  initialName: string;
  className?: string;
  busy?: boolean;
  showBusyVisual?: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
};

export default function InlineNameInput({
  initialName,
  className,
  busy = false,
  showBusyVisual = false,
  onCommit,
  onCancel,
}: InlineNameInputProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || busy) {
      return;
    }
    input.focus();
    const end = initialName.length;
    input.setSelectionRange(0, end);
  }, [busy, initialName]);

  return (
    <span className="flex min-w-0 items-center gap-1">
      <input
        ref={inputRef}
        className={cn(
          "min-w-0 flex-1 rounded border border-input bg-background px-1 text-base outline-none ring-ring focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        value={value}
        disabled={busy}
        onChange={(event) => setValue(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (busy) {
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(value.trim());
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (!busy) {
            onCommit(value.trim());
          }
        }}
      />
      {busy && showBusyVisual ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
