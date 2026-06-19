import { cn } from "@/lib/utils";
import { formatKeybindingLabel } from "./keybindings";

type ChordKbdProps = {
  chord: string;
  className?: string;
};

export default function ChordKbd({ chord, className }: ChordKbdProps) {
  return (
    <span
      className={cn(
        "text-sm text-muted-foreground",
        "[[data-slot=tooltip-content]_&]:text-background/70",
        className,
      )}
    >
      {formatKeybindingLabel(chord)}
    </span>
  );
}
