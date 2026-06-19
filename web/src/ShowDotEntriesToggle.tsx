import { Eye, EyeOff } from "lucide-react";

import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useShowDotEntries } from "@/settings/ShowDotEntriesProvider";

export default function ShowDotEntriesToggle() {
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
          className="h-9 w-9"
          aria-label={label}
          aria-pressed={showDotEntries}
          onClick={toggleShowDotEntries}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
