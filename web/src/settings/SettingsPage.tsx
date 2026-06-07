import { ArrowLeft, Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import LanguageToggle from "@/LanguageToggle";
import ThemeToggle from "@/ThemeToggle";
import { useTranslation } from "@/i18n";
import { useAppRoute } from "@/routing/AppRouteProvider";
import { useGridCardSize } from "@/settings/GridCardSizeProvider";
import { useGridImagePreviews } from "@/settings/GridImagePreviewsProvider";
import { useGridThumbnailBadge } from "@/settings/GridThumbnailBadgeProvider";
import { useModifiedTimeFormat } from "@/settings/ModifiedTimeFormatProvider";
import { useListingSortOrder } from "@/settings/ListingSortOrderProvider";
import { useShowDotEntries } from "@/settings/ShowDotEntriesProvider";
import type { ModifiedTimeFormat } from "@/settings/modifiedTimeFormat";
import type { ListingSortOrder } from "@/settings/listingSortOrder";
import type { ShowDotEntriesVisibility } from "@/settings/showDotEntries";
import type { GridCardSize } from "@/settings/gridCardSize";
import { UNLIMITED_GRID_CARD_DIMENSION } from "@/settings/gridCardSize";
import {
  readStoredPasteBatchOnError,
  storePasteBatchOnError,
  type PasteBatchOnError,
} from "@/settings/pasteBatchOnError";
import {
  readStoredPasteDestination,
  storePasteDestination,
  type PasteDestinationWhenFolderSelected,
} from "@/settings/pasteDestination";
import { useTheme } from "@/useTheme";

function parseDimensionInput(value: string, allowUnlimited = false): number | null {
  const trimmed = value.trim();
  if (allowUnlimited && trimmed === "0") {
    return UNLIMITED_GRID_CARD_DIMENSION;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  if (allowUnlimited && parsed === 0) {
    return UNLIMITED_GRID_CARD_DIMENSION;
  }
  if (parsed <= 0) {
    return null;
  }
  return parsed;
}

type GridCardSizeFieldsProps = {
  widthLabel: string;
  heightLabel: string;
  size: GridCardSize;
  allowUnlimitedMax?: boolean;
  onChange: (size: GridCardSize) => void;
};

function GridCardSizeFields({
  widthLabel,
  heightLabel,
  size,
  allowUnlimitedMax = false,
  onChange,
}: GridCardSizeFieldsProps) {
  const commit = (partial: Partial<GridCardSize>) => {
    onChange({ ...size, ...partial });
  };

  return (
    <div className="grid max-w-md grid-cols-2 gap-3">
      <label className="space-y-1 text-sm">
        <span className="font-medium">{widthLabel}</span>
        <Input
          type="number"
          min={allowUnlimitedMax ? 0 : 1}
          value={size.width === UNLIMITED_GRID_CARD_DIMENSION ? 0 : size.width}
          onChange={(event) => {
            const next = parseDimensionInput(event.target.value, allowUnlimitedMax);
            if (next != null) {
              commit({ width: next });
            }
          }}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">{heightLabel}</span>
        <Input
          type="number"
          min={allowUnlimitedMax ? 0 : 1}
          value={size.height === UNLIMITED_GRID_CARD_DIMENSION ? 0 : size.height}
          onChange={(event) => {
            const next = parseDimensionInput(event.target.value, allowUnlimitedMax);
            if (next != null) {
              commit({ height: next });
            }
          }}
        />
      </label>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { navigate } = useAppRoute();
  const { format, setFormat } = useModifiedTimeFormat();
  const { order: listingSortOrder, setOrder: setListingSortOrder } = useListingSortOrder();
  const { visibility, setVisibility } = useShowDotEntries();
  const {
    defaultSize,
    minSize,
    maxSize,
    setDefaultSize,
    setMinSize,
    setMaxSize,
  } = useGridCardSize();
  const { enabled: gridImagePreviewsEnabled, setEnabled: setGridImagePreviewsEnabled } =
    useGridImagePreviews();
  const { enabled: gridThumbnailBadgeEnabled, setEnabled: setGridThumbnailBadgeEnabled } =
    useGridThumbnailBadge();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [pasteDestination, setPasteDestination] = useState(
    readStoredPasteDestination,
  );
  const [pasteBatchOnError, setPasteBatchOnError] = useState(readStoredPasteBatchOnError);

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

        <div className="mt-8 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.gridImagePreviews.label")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.gridImagePreviews.description")}
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={gridImagePreviewsEnabled ? "enabled" : "disabled"}
            onValueChange={(value) => {
              if (value === "enabled") {
                setGridImagePreviewsEnabled(true);
              } else if (value === "disabled") {
                setGridImagePreviewsEnabled(false);
              }
            }}
            aria-label={t("settings.gridImagePreviews.label")}
          >
            <ToggleGroupItem
              value="enabled"
              aria-label={t("settings.gridImagePreviews.enabled")}
            >
              {t("settings.gridImagePreviews.enabled")}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="disabled"
              aria-label={t("settings.gridImagePreviews.disabled")}
            >
              {t("settings.gridImagePreviews.disabled")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-8 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.gridThumbnailBadge.label")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.gridThumbnailBadge.description")}
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={gridThumbnailBadgeEnabled ? "enabled" : "disabled"}
            onValueChange={(value) => {
              if (value === "enabled") {
                setGridThumbnailBadgeEnabled(true);
              } else if (value === "disabled") {
                setGridThumbnailBadgeEnabled(false);
              }
            }}
            aria-label={t("settings.gridThumbnailBadge.label")}
          >
            <ToggleGroupItem
              value="enabled"
              aria-label={t("settings.gridThumbnailBadge.enabled")}
            >
              {t("settings.gridThumbnailBadge.enabled")}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="disabled"
              aria-label={t("settings.gridThumbnailBadge.disabled")}
            >
              {t("settings.gridThumbnailBadge.disabled")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-8 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.gridCard.label")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.gridCard.description")}
            </p>
          </div>
          <GridCardSizeFields
            widthLabel={t("settings.gridCard.defaultWidth")}
            heightLabel={t("settings.gridCard.defaultHeight")}
            size={defaultSize}
            onChange={setDefaultSize}
          />
          <GridCardSizeFields
            widthLabel={t("settings.gridCard.minWidth")}
            heightLabel={t("settings.gridCard.minHeight")}
            size={minSize}
            onChange={setMinSize}
          />
          <GridCardSizeFields
            widthLabel={t("settings.gridCard.maxWidth")}
            heightLabel={t("settings.gridCard.maxHeight")}
            size={maxSize}
            allowUnlimitedMax
            onChange={setMaxSize}
          />
          <p className="text-sm text-muted-foreground">{t("settings.gridCard.maxHint")}</p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-6">
        <h2 className="text-base font-semibold">{t("settings.paste.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.paste.description")}
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.paste.destination.label")}</p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={pasteDestination}
            onValueChange={(value) => {
              if (!value) {
                return;
              }
              const next = value as PasteDestinationWhenFolderSelected;
              setPasteDestination(next);
              storePasteDestination(next);
            }}
            aria-label={t("settings.paste.destination.label")}
          >
            <ToggleGroupItem value="ask" aria-label={t("settings.paste.destination.ask")}>
              {t("settings.paste.destination.ask")}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="into_selected_folder"
              aria-label={t("settings.paste.destination.intoSelected")}
            >
              {t("settings.paste.destination.intoSelected")}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="into_current_directory"
              aria-label={t("settings.paste.destination.intoCurrent")}
            >
              {t("settings.paste.destination.intoCurrent")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-8 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("settings.paste.batch.label")}</p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={pasteBatchOnError}
            onValueChange={(value) => {
              if (!value) {
                return;
              }
              const next = value as PasteBatchOnError;
              setPasteBatchOnError(next);
              storePasteBatchOnError(next);
            }}
            aria-label={t("settings.paste.batch.label")}
          >
            <ToggleGroupItem value="stop" aria-label={t("settings.paste.batch.stop")}>
              {t("settings.paste.batch.stop")}
            </ToggleGroupItem>
            <ToggleGroupItem value="continue" aria-label={t("settings.paste.batch.continue")}>
              {t("settings.paste.batch.continue")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>
    </main>
  );
}
