import { LayoutGrid, Table } from "lucide-react";

import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { nextListingViewMode, type ListingViewMode } from "@/listingView";
import { shortcutsHintParams } from "@/actions/keybindings";

export type ListingViewChangeOptions = {
  global?: boolean;
};

type ListingViewToggleProps = {
  mode: ListingViewMode;
  onChange: (mode: ListingViewMode, options?: ListingViewChangeOptions) => void;
};

export default function ListingViewToggle({ mode, onChange }: ListingViewToggleProps) {
  const { t } = useTranslation();
  const showGrid = mode === "table";
  const label = showGrid ? t("listing.view.grid") : t("listing.view.table");
  const hint = showGrid
    ? t("listing.view.gridHint", shortcutsHintParams())
    : t("listing.view.tableHint", shortcutsHintParams());
  const Icon = showGrid ? LayoutGrid : Table;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 touch-ui:h-11 touch-ui:w-11"
          aria-label={label}
          aria-pressed={mode === "grid"}
          onClick={(event) =>
            onChange(nextListingViewMode(mode), { global: event.shiftKey })
          }
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div>{label}</div>
        <div className="text-muted-foreground text-xs">{hint}</div>
      </TooltipContent>
    </Tooltip>
  );
}
