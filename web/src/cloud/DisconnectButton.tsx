import { Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";

type DisconnectButtonProps = {
  onClick: () => void;
};

export default function DisconnectButton({ onClick }: DisconnectButtonProps) {
  const { t } = useTranslation();
  const label = t("connect.disconnect");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label={label}
            onClick={onClick}
          >
            <Unplug className="h-4 w-4" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
