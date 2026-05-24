import { LayoutGrid, Table } from "lucide-react";

import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toggleListingViewMode, type ListingViewMode } from "@/listingView";

type ListingViewToggleProps = {
  mode: ListingViewMode;
  onChange: (mode: ListingViewMode) => void;
};

export default function ListingViewToggle({ mode, onChange }: ListingViewToggleProps) {
  const { t } = useTranslation();
  const showGrid = mode === "table";
  const label = showGrid ? t("listing.view.grid") : t("listing.view.table");
  const Icon = showGrid ? LayoutGrid : Table;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label={label}
          aria-pressed={mode === "grid"}
          onClick={() => onChange(toggleListingViewMode(mode))}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
