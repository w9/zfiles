import { keyPartLabel, parseKeyChord } from "./keybindings";

export function chordToKbdLabels(
  chord: string,
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): string[] {
  return parseKeyChord(chord).map((part) => keyPartLabel(part, platform));
}
