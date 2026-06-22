import type { ReactNode } from "react";

import { AppRouteProvider } from "./routing/AppRouteProvider";
import { GridCardSizeProvider } from "./settings/GridCardSizeProvider";
import { GridImagePreviewsProvider } from "./settings/GridImagePreviewsProvider";
import { GridThumbnailBadgeProvider } from "./settings/GridThumbnailBadgeProvider";
import { ListingSortOrderProvider } from "./settings/ListingSortOrderProvider";
import { ModifiedTimeFormatProvider } from "./settings/ModifiedTimeFormatProvider";
import { ShowDotEntriesProvider } from "./settings/ShowDotEntriesProvider";
import { SlideshowSettingsProvider } from "./settings/SlideshowSettingsProvider";
import type { BootMode } from "./settings/gridImagePreviews";

/**
 * Shared explorer settings/routing provider stack used by both the local and
 * cloud entry points. Only `bootMode` differs between modes. I18n (outermost)
 * and backend/tooltip wiring (innermost) stay with each entry because cloud's
 * connect flow renders outside this stack.
 */
export function ExplorerSettingsProviders({
  bootMode,
  children,
}: {
  bootMode: BootMode;
  children: ReactNode;
}) {
  return (
    <AppRouteProvider>
      <ModifiedTimeFormatProvider>
        <GridCardSizeProvider>
          <ListingSortOrderProvider>
            <ShowDotEntriesProvider>
              <GridImagePreviewsProvider bootMode={bootMode}>
                <GridThumbnailBadgeProvider bootMode={bootMode}>
                  <SlideshowSettingsProvider>{children}</SlideshowSettingsProvider>
                </GridThumbnailBadgeProvider>
              </GridImagePreviewsProvider>
            </ShowDotEntriesProvider>
          </ListingSortOrderProvider>
        </GridCardSizeProvider>
      </ModifiedTimeFormatProvider>
    </AppRouteProvider>
  );
}
