import { Eye, EyeOff } from "lucide-react";

import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useShowDotEntries } from "@/settings/ShowDotEntriesProvider";

type ShowDotEntriesToggleProps = {
  onToggle?: () => void;
};

export default function ShowDotEntriesToggle({ onToggle }: ShowDotEntriesToggleProps) {
  const { t } = useTranslation();
  const { showDotEntries, toggleShowDotEntries } = useShowDotEntries();
  const label = showDotEntries
    ? t("listing.dotEntries.hide")
    : t("listing.dotEntries.show");
  const Icon = showDotEntries ? EyeOff : Eye;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={label}
          aria-pressed={showDotEntries}
          onClick={onToggle ?? toggleShowDotEntries}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
