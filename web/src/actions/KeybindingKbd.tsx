import { cn } from "@/lib/utils";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { chordToKbdLabels } from "./keybindingDisplay";

type KeybindingKbdProps = {
  chord: string;
  className?: string;
};

export default function KeybindingKbd({ chord, className }: KeybindingKbdProps) {
  const labels = chordToKbdLabels(chord);
  return (
    <KbdGroup className={cn("ml-auto shrink-0", className)}>
      {labels.map((label, index) => (
        <Kbd key={`${label}-${index}`}>{label}</Kbd>
      ))}
    </KbdGroup>
  );
}
