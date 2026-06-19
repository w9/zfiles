import { Link2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import { appBasePath } from "@/routing/appBase";
import { toast } from "sonner";
import {
  buildShareUrl,
  type ShareUrlInput,
} from "./shareUrl";
import { readShareUrlIncludeCredentials } from "./shareUrlSettings";

type ShareUrlButtonProps = {
  input: ShareUrlInput;
  explorerPath?: string;
  includeCredentials?: boolean;
  variant?: ButtonProps["variant"];
};

export default function ShareUrlButton({
  input,
  explorerPath = "",
  includeCredentials,
  variant = "outline",
}: ShareUrlButtonProps) {
  const { t } = useTranslation();
  const label = t("connect.shareUrl.label");

  const onClick = async () => {
    const url = buildShareUrl(input, {
      explorerPath,
      includeCredentials: includeCredentials ?? readShareUrlIncludeCredentials(),
      origin: window.location.origin,
      base: appBasePath(),
    });
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("connect.shareUrl.copied"));
    } catch {
      toast.error(t("connect.shareUrl.copyFailed"));
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant={variant}
            size="icon"
            className="h-9 w-9"
            aria-label={label}
            onClick={() => void onClick()}
          >
            <Link2 className="h-5 w-5" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
