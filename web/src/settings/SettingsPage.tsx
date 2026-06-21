import { ArrowLeft, Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import LanguageToggle from "@/LanguageToggle";
import ThemeToggle from "@/ThemeToggle";
import UiModeToggle from "@/UiModeToggle";
import { useTranslation } from "@/i18n";
import { useAppRoute } from "@/routing/AppRouteProvider";
import { useGridCardSize } from "@/settings/GridCardSizeProvider";
import { useGridImagePreviews } from "@/settings/GridImagePreviewsProvider";
import { useGridThumbnailBadge } from "@/settings/GridThumbnailBadgeProvider";
import { useSlideshowSettings } from "@/settings/SlideshowSettingsProvider";
import { useSlideshowIntervalInput } from "@/settings/useSlideshowIntervalInput";
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
import { useUiMode } from "@/useUiMode";
import { detectBootMode } from "@/cloud/bootParams";
import {
  readShareUrlIncludeCredentials,
  storeShareUrlIncludeCredentials,
} from "@/cloud/shareUrlSettings";
import {
  readUploadChecksumValidation,
  storeUploadChecksumValidation,
} from "@/settings/uploadChecksumSettings";

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

type SettingsToggleFieldProps<T extends string> = {
  label: string;
  description?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
};

function SettingsToggleField<T extends string>({
  label,
  description,
  value,
  onValueChange,
  options,
}: SettingsToggleFieldProps<T>) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value}
        onValueChange={(next) => {
          if (next) {
            onValueChange(next as T);
          }
        }}
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

type GridCardSizeFieldsProps = {
  idPrefix: string;
  widthLabel: string;
  heightLabel: string;
  size: GridCardSize;
  allowUnlimitedMax?: boolean;
  onChange: (size: GridCardSize) => void;
};

function GridCardSizeFields({
  idPrefix,
  widthLabel,
  heightLabel,
  size,
  allowUnlimitedMax = false,
  onChange,
}: GridCardSizeFieldsProps) {
  const widthId = `${idPrefix}-width`;
  const heightId = `${idPrefix}-height`;
  const commit = (partial: Partial<GridCardSize>) => {
    onChange({ ...size, ...partial });
  };

  return (
    <FieldGroup className="grid max-w-md grid-cols-2 gap-3">
      <Field>
        <FieldLabel htmlFor={widthId}>{widthLabel}</FieldLabel>
        <Input
          id={widthId}
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
      </Field>
      <Field>
        <FieldLabel htmlFor={heightId}>{heightLabel}</FieldLabel>
        <Input
          id={heightId}
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
      </Field>
    </FieldGroup>
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
  const {
    autoplayOnOpen,
    setAutoplayOnOpen,
    startAtActiveItem,
    setStartAtActiveItem,
    intervalSeconds,
    setIntervalSeconds,
  } = useSlideshowSettings();
  const slideshowIntervalInput = useSlideshowIntervalInput(intervalSeconds, setIntervalSeconds);
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { mode: uiMode, setMode: setUiMode } = useUiMode();
  const [pasteDestination, setPasteDestination] = useState(
    readStoredPasteDestination,
  );
  const [pasteBatchOnError, setPasteBatchOnError] = useState(readStoredPasteBatchOnError);
  const isCloudMode = detectBootMode() === "cloud";
  const [shareUrlIncludeCredentials, setShareUrlIncludeCredentials] = useState(
    readShareUrlIncludeCredentials,
  );
  const [uploadChecksumValidation, setUploadChecksumValidation] = useState(
    readUploadChecksumValidation,
  );

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
          <UiModeToggle mode={uiMode} onChange={setUiMode} />
          <LanguageToggle iconOnly />
        </div>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <FieldSet>
          <FieldLegend>{t("settings.display.title")}</FieldLegend>
          <FieldDescription>{t("settings.display.description")}</FieldDescription>
          <FieldGroup>
            <SettingsToggleField
              label={t("settings.modifiedTime.label")}
              description={t("settings.modifiedTime.description")}
              value={format}
              onValueChange={(value) => setFormat(value as ModifiedTimeFormat)}
              options={[
                { value: "relative", label: t("settings.modifiedTime.relative") },
                { value: "absolute", label: t("settings.modifiedTime.absolute") },
              ]}
            />
            <SettingsToggleField
              label={t("settings.listingSort.label")}
              description={t("settings.listingSort.description")}
              value={listingSortOrder}
              onValueChange={(value) => setListingSortOrder(value as ListingSortOrder)}
              options={[
                { value: "folders-first", label: t("settings.listingSort.foldersFirst") },
                { value: "mixed", label: t("settings.listingSort.mixed") },
              ]}
            />
            <SettingsToggleField
              label={t("settings.dotEntries.label")}
              description={t("settings.dotEntries.description")}
              value={visibility}
              onValueChange={(value) => setVisibility(value as ShowDotEntriesVisibility)}
              options={[
                { value: "hidden", label: t("settings.dotEntries.hidden") },
                { value: "visible", label: t("settings.dotEntries.visible") },
              ]}
            />
            <SettingsToggleField
              label={t("settings.gridImagePreviews.label")}
              description={t("settings.gridImagePreviews.description")}
              value={gridImagePreviewsEnabled ? "enabled" : "disabled"}
              onValueChange={(value) => setGridImagePreviewsEnabled(value === "enabled")}
              options={[
                { value: "enabled", label: t("settings.gridImagePreviews.enabled") },
                { value: "disabled", label: t("settings.gridImagePreviews.disabled") },
              ]}
            />
            <SettingsToggleField
              label={t("settings.gridThumbnailBadge.label")}
              description={t("settings.gridThumbnailBadge.description")}
              value={gridThumbnailBadgeEnabled ? "enabled" : "disabled"}
              onValueChange={(value) => setGridThumbnailBadgeEnabled(value === "enabled")}
              options={[
                { value: "enabled", label: t("settings.gridThumbnailBadge.enabled") },
                { value: "disabled", label: t("settings.gridThumbnailBadge.disabled") },
              ]}
            />
            <Field>
              <FieldLabel>{t("settings.slideshow.label")}</FieldLabel>
              <FieldDescription>{t("settings.slideshow.description")}</FieldDescription>
              <FieldGroup className="gap-4">
                <SettingsToggleField
                  label={t("settings.slideshow.autoplay.label")}
                  description={t("settings.slideshow.autoplay.description")}
                  value={autoplayOnOpen ? "enabled" : "disabled"}
                  onValueChange={(value) => setAutoplayOnOpen(value === "enabled")}
                  options={[
                    { value: "enabled", label: t("settings.slideshow.autoplay.enabled") },
                    { value: "disabled", label: t("settings.slideshow.autoplay.disabled") },
                  ]}
                />
                <SettingsToggleField
                  label={t("settings.slideshow.startAtActiveItem.label")}
                  description={t("settings.slideshow.startAtActiveItem.description")}
                  value={startAtActiveItem ? "enabled" : "disabled"}
                  onValueChange={(value) => setStartAtActiveItem(value === "enabled")}
                  options={[
                    {
                      value: "enabled",
                      label: t("settings.slideshow.startAtActiveItem.enabled"),
                    },
                    {
                      value: "disabled",
                      label: t("settings.slideshow.startAtActiveItem.disabled"),
                    },
                  ]}
                />
                <Field>
                  <FieldLabel htmlFor="settings-slideshow-interval">
                    {t("settings.slideshow.interval.label")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("settings.slideshow.interval.description")}
                  </FieldDescription>
                  <Input
                    id="settings-slideshow-interval"
                    type="number"
                    className="h-9 w-28"
                    {...slideshowIntervalInput}
                  />
                </Field>
              </FieldGroup>
            </Field>
            <Field>
              <FieldLabel>{t("settings.gridCard.label")}</FieldLabel>
              <FieldDescription>{t("settings.gridCard.description")}</FieldDescription>
              <FieldGroup className="gap-3">
                <GridCardSizeFields
                  idPrefix="grid-default"
                  widthLabel={t("settings.gridCard.defaultWidth")}
                  heightLabel={t("settings.gridCard.defaultHeight")}
                  size={defaultSize}
                  onChange={setDefaultSize}
                />
                <GridCardSizeFields
                  idPrefix="grid-min"
                  widthLabel={t("settings.gridCard.minWidth")}
                  heightLabel={t("settings.gridCard.minHeight")}
                  size={minSize}
                  onChange={setMinSize}
                />
                <GridCardSizeFields
                  idPrefix="grid-max"
                  widthLabel={t("settings.gridCard.maxWidth")}
                  heightLabel={t("settings.gridCard.maxHeight")}
                  size={maxSize}
                  allowUnlimitedMax
                  onChange={setMaxSize}
                />
                <FieldDescription>{t("settings.gridCard.maxHint")}</FieldDescription>
              </FieldGroup>
            </Field>
          </FieldGroup>
        </FieldSet>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-6">
        <FieldSet>
          <FieldLegend>{t("settings.paste.title")}</FieldLegend>
          <FieldDescription>{t("settings.paste.description")}</FieldDescription>
          <FieldGroup>
            <SettingsToggleField
              label={t("settings.paste.destination.label")}
              value={pasteDestination}
              onValueChange={(value) => {
                const next = value as PasteDestinationWhenFolderSelected;
                setPasteDestination(next);
                storePasteDestination(next);
              }}
              options={[
                { value: "ask", label: t("settings.paste.destination.ask") },
                {
                  value: "into_selected_folder",
                  label: t("settings.paste.destination.intoSelected"),
                },
                {
                  value: "into_current_directory",
                  label: t("settings.paste.destination.intoCurrent"),
                },
              ]}
            />
            <SettingsToggleField
              label={t("settings.paste.batch.label")}
              value={pasteBatchOnError}
              onValueChange={(value) => {
                const next = value as PasteBatchOnError;
                setPasteBatchOnError(next);
                storePasteBatchOnError(next);
              }}
              options={[
                { value: "stop", label: t("settings.paste.batch.stop") },
                { value: "continue", label: t("settings.paste.batch.continue") },
              ]}
            />
          </FieldGroup>
        </FieldSet>
      </section>

      {isCloudMode ? (
        <section className="mt-6 rounded-xl border bg-card p-6">
          <FieldSet>
            <FieldLegend>{t("settings.uploadChecksum.title")}</FieldLegend>
            <FieldDescription>{t("settings.uploadChecksum.description")}</FieldDescription>
            <Field orientation="horizontal">
              <Checkbox
                id="settings-upload-checksum-validation"
                checked={uploadChecksumValidation}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setUploadChecksumValidation(next);
                  storeUploadChecksumValidation(next);
                }}
              />
              <FieldLabel htmlFor="settings-upload-checksum-validation">
                {t("settings.uploadChecksum.label")}
              </FieldLabel>
            </Field>
          </FieldSet>
        </section>
      ) : null}

      {isCloudMode ? (
        <section className="mt-6 rounded-xl border bg-card p-6">
          <FieldSet>
            <FieldLegend>{t("settings.shareUrl.title")}</FieldLegend>
            <FieldDescription>{t("settings.shareUrl.description")}</FieldDescription>
            <Field orientation="horizontal">
              <Checkbox
                id="settings-share-url-include-credentials"
                checked={shareUrlIncludeCredentials}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setShareUrlIncludeCredentials(next);
                  storeShareUrlIncludeCredentials(next);
                }}
              />
              <FieldLabel htmlFor="settings-share-url-include-credentials">
                {t("connect.shareUrl.includeCredentials")}
              </FieldLabel>
            </Field>
          </FieldSet>
        </section>
      ) : null}
    </main>
  );
}
