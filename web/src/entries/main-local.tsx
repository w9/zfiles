import React from "react";
import ReactDOM from "react-dom/client";

import { stripShareTokenFromUrl } from "../api";
import AppShell from "../AppShell";
import { ExplorerBackendProvider } from "../backend";
import { I18nProvider } from "../i18n";
import { ModifiedTimeFormatProvider } from "../settings/ModifiedTimeFormatProvider";
import { GridCardSizeProvider } from "../settings/GridCardSizeProvider";
import { ListingSortOrderProvider } from "../settings/ListingSortOrderProvider";
import { GridImagePreviewsProvider } from "../settings/GridImagePreviewsProvider";
import { GridThumbnailBadgeProvider } from "../settings/GridThumbnailBadgeProvider";
import { SlideshowSettingsProvider } from "../settings/SlideshowSettingsProvider";
import { ShowDotEntriesProvider } from "../settings/ShowDotEntriesProvider";
import { AppRouteProvider } from "../routing/AppRouteProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../index.css";

stripShareTokenFromUrl();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <AppRouteProvider>
        <ModifiedTimeFormatProvider>
          <GridCardSizeProvider>
            <ListingSortOrderProvider>
              <ShowDotEntriesProvider>
                <GridImagePreviewsProvider bootMode="local">
                  <GridThumbnailBadgeProvider bootMode="local">
                    <SlideshowSettingsProvider>
                      <ExplorerBackendProvider>
                        <TooltipProvider>
                          <AppShell />
                        </TooltipProvider>
                      </ExplorerBackendProvider>
                    </SlideshowSettingsProvider>
                  </GridThumbnailBadgeProvider>
                </GridImagePreviewsProvider>
              </ShowDotEntriesProvider>
            </ListingSortOrderProvider>
          </GridCardSizeProvider>
        </ModifiedTimeFormatProvider>
      </AppRouteProvider>
    </I18nProvider>
  </React.StrictMode>,
);
