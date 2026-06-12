import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { chordToKbdLabels } from "./keybindingDisplay";

type ChordKbdProps = {
  chord: string;
  /** Applied to each key chip. */
  className?: string;
};

export default function ChordKbd({ chord, className }: ChordKbdProps) {
  return (
    <KbdGroup>
      {chordToKbdLabels(chord).map((label, index) => (
        <Kbd key={`${index}-${label}`} className={className}>
          {label}
        </Kbd>
      ))}
    </KbdGroup>
  );
}
