import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type InlineNameInputProps = {
  initialName: string;
  className?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
};

export default function InlineNameInput({
  initialName,
  className,
  onCommit,
  onCancel,
}: InlineNameInputProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    const end = initialName.length;
    input.setSelectionRange(0, end);
  }, [initialName]);

  return (
    <input
      ref={inputRef}
      className={cn(
        "h-6 min-w-0 flex-1 rounded border border-input bg-background px-1 text-[14px] leading-5 outline-none ring-ring focus-visible:ring-2",
        className,
      )}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(value.trim());
        } else if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => onCommit(value.trim())}
    />
  );
}
