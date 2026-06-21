import { Hand, Monitor, MousePointer2 } from "lucide-react";

import { nextUiMode, type UiMode } from "./uiMode";
import type { MessageKey } from "@/i18n/locales/en";
import { useTranslation } from "@/i18n";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type UiModeToggleProps = {
  mode: UiMode;
  onChange: (mode: UiMode) => void;
  variant?: ButtonProps["variant"];
};

const UI_MODE_KEYS: Record<UiMode, MessageKey> = {
  mouse: "uiMode.mouse",
  touch: "uiMode.touch",
  auto: "uiMode.auto",
};

const UI_MODE_ICONS: Record<UiMode, typeof MousePointer2> = {
  mouse: MousePointer2,
  touch: Hand,
  auto: Monitor,
};

export default function UiModeToggle({
  mode,
  onChange,
  variant = "outline",
}: UiModeToggleProps) {
  const { t } = useTranslation();
  const Icon = UI_MODE_ICONS[mode];
  const label = `${t("uiMode.group")}: ${t(UI_MODE_KEYS[mode])}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          className="h-8 w-8 touch-ui:h-11 touch-ui:w-11"
          aria-label={label}
          onClick={() => onChange(nextUiMode(mode))}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
