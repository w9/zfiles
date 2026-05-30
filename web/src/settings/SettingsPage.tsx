import { ArrowLeft, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import LanguageToggle from "@/LanguageToggle";
import ThemeToggle from "@/ThemeToggle";
import { useTranslation } from "@/i18n";
import { useAppRoute } from "@/routing/AppRouteProvider";
import { useModifiedTimeFormat } from "@/settings/ModifiedTimeFormatProvider";
import { useListingSortOrder } from "@/settings/ListingSortOrderProvider";
import { useShowDotEntries } from "@/settings/ShowDotEntriesProvider";
import type { ModifiedTimeFormat } from "@/settings/modifiedTimeFormat";
import type { ListingSortOrder } from "@/settings/listingSortOrder";
import type { ShowDotEntriesVisibility } from "@/settings/showDotEntries";
import { useTheme } from "@/useTheme";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { navigate } = useAppRoute();
  const { format, setFormat } = useModifiedTimeFormat();
  const { order: listingSortOrder, setOrder: setListingSortOrder } = useListingSortOrder();
  const { visibility, setVisibility } = useShowDotEntries();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label={t("settings.back")}
            onClick={() => navigate("explorer")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" aria-hidden />
            <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle mode={themeMode} onChange={setThemeMode} />
          <LanguageToggle iconOnly />
        </div>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-base font-semibold">{t("settings.display.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.display.description")}
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.modifiedTime.label")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.modifiedTime.description")}
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={format}
            onValueChange={(value) => {
              if (value) {
                setFormat(value as ModifiedTimeFormat);
              }
            }}
            aria-label={t("settings.modifiedTime.label")}
          >
            <ToggleGroupItem value="relative" aria-label={t("settings.modifiedTime.relative")}>
              {t("settings.modifiedTime.relative")}
            </ToggleGroupItem>
            <ToggleGroupItem value="absolute" aria-label={t("settings.modifiedTime.absolute")}>
              {t("settings.modifiedTime.absolute")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-8 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.listingSort.label")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.listingSort.description")}
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={listingSortOrder}
            onValueChange={(value) => {
              if (value) {
                setListingSortOrder(value as ListingSortOrder);
              }
            }}
            aria-label={t("settings.listingSort.label")}
          >
            <ToggleGroupItem
              value="folders-first"
              aria-label={t("settings.listingSort.foldersFirst")}
            >
              {t("settings.listingSort.foldersFirst")}
            </ToggleGroupItem>
            <ToggleGroupItem value="mixed" aria-label={t("settings.listingSort.mixed")}>
              {t("settings.listingSort.mixed")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-8 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.dotEntries.label")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.dotEntries.description")}
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={visibility}
            onValueChange={(value) => {
              if (value) {
                setVisibility(value as ShowDotEntriesVisibility);
              }
            }}
            aria-label={t("settings.dotEntries.label")}
          >
            <ToggleGroupItem value="hidden" aria-label={t("settings.dotEntries.hidden")}>
              {t("settings.dotEntries.hidden")}
            </ToggleGroupItem>
            <ToggleGroupItem value="visible" aria-label={t("settings.dotEntries.visible")}>
              {t("settings.dotEntries.visible")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>
    </main>
  );
}
