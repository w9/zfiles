import type { ThemeMode } from "./theme";

type ThemeToggleProps = {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
};

const OPTIONS: ThemeMode[] = ["light", "dark", "auto"];

function label(mode: ThemeMode): string {
  switch (mode) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    case "auto":
      return "Auto";
  }
}

export default function ThemeToggle({ mode, onChange }: ThemeToggleProps) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          className="theme-toggle-option"
          aria-checked={mode === option}
          data-active={mode === option ? "true" : "false"}
          onClick={() => onChange(option)}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}
