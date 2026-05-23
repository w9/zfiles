import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Locale, useTranslation } from "@/i18n";

const LOCALES: Locale[] = ["en", "zh-CN"];

function localeLabel(locale: Locale, t: (key: "language.en" | "language.zhCN") => string) {
  return locale === "zh-CN" ? t("language.zhCN") : t("language.en");
}

type LanguageToggleProps = {
  compact?: boolean;
};

export default function LanguageToggle({ compact = false }: LanguageToggleProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "sm"}
          className={compact ? "h-8 gap-2 px-2" : undefined}
          aria-label={t("language.group")}
        >
          <Languages className="h-4 w-4" />
          {compact ? (
            <span className="text-sm">{localeLabel(locale, t)}</span>
          ) : (
            <span>{localeLabel(locale, t)}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
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
