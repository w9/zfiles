import { parseKeyChord } from "./keybindings";

export function chordToKbdLabels(
  chord: string,
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): string[] {
  const isMac = platform.toLowerCase().includes("mac");
  return parseKeyChord(chord).map((part) => {
    switch (part) {
      case "Mod":
        return isMac ? "⌘" : "Ctrl";
      case "Shift":
        return isMac ? "⇧" : "Shift";
      case "Alt":
        return isMac ? "⌥" : "Alt";
      case "Space":
        return "Space";
      default:
        return part;
    }
  });
}
