import { Monitor, Moon, Sun } from "lucide-react";

import { nextThemeMode, type ThemeMode } from "./theme";
import type { MessageKey } from "@/i18n/locales/en";
import { useTranslation } from "@/i18n";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ThemeToggleProps = {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  variant?: ButtonProps["variant"];
};

const THEME_KEYS: Record<ThemeMode, MessageKey> = {
  light: "theme.light",
  dark: "theme.dark",
  auto: "theme.auto",
};

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  auto: Monitor,
};

export default function ThemeToggle({
  mode,
  onChange,
  variant = "outline",
}: ThemeToggleProps) {
  const { t } = useTranslation();
  const Icon = THEME_ICONS[mode];
  const label = `${t("theme.group")}: ${t(THEME_KEYS[mode])}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          className="h-8 w-8"
          aria-label={label}
          onClick={() => onChange(nextThemeMode(mode))}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
