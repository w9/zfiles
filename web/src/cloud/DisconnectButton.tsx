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
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label={label}
            onClick={onClick}
          >
            <Unplug className="h-5 w-5" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
