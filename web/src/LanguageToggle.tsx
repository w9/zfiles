import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Locale, useTranslation } from "@/i18n";

const LOCALES: Locale[] = ["en", "zh-CN"];

function localeLabel(locale: Locale, t: (key: "language.en" | "language.zhCN") => string) {
  return locale === "zh-CN" ? t("language.zhCN") : t("language.en");
}

type LanguageToggleProps = {
  iconOnly?: boolean;
};

export default function LanguageToggle({ iconOnly = false }: LanguageToggleProps) {
  const { locale, setLocale, t } = useTranslation();
  const currentLabel = localeLabel(locale, t);

  const menuButton = (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      className={iconOnly ? "h-8 w-8" : undefined}
      aria-label={t("language.group")}
    >
      <Languages className="h-4 w-4" />
      {!iconOnly ? <span>{currentLabel}</span> : null}
    </Button>
  );

  return (
    <DropdownMenu>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{menuButton}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{currentLabel}</TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{menuButton}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => setLocale(value as Locale)}
        >
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {localeLabel(option, t)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
