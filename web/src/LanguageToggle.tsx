import { Languages } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
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
import { type Locale, type MessageKey, SUPPORTED_LOCALES, useTranslation } from "@/i18n";
import { LOCALE_LABEL_KEYS } from "@/i18n/localeLabels";

function localeLabel(locale: Locale, t: (key: MessageKey) => string) {
  return t(LOCALE_LABEL_KEYS[locale]);
}

type LanguageToggleProps = {
  iconOnly?: boolean;
  variant?: ButtonProps["variant"];
  onLocaleChange?: (locale: Locale) => void;
};

export default function LanguageToggle({
  iconOnly = false,
  variant = "outline",
  onLocaleChange,
}: LanguageToggleProps) {
  const { locale, setLocale, t } = useTranslation();
  const currentLabel = localeLabel(locale, t);

  const menuButton = (
    <Button
      type="button"
      variant={variant}
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
      <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => (onLocaleChange ?? setLocale)(value as Locale)}
        >
          {SUPPORTED_LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {localeLabel(option, t)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
