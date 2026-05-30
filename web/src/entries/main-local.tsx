import React from "react";
import ReactDOM from "react-dom/client";

import { bootstrapSessionFromUrl } from "../api";
import AppShell from "../AppShell";
import { ExplorerBackendProvider } from "../backend";
import { I18nProvider } from "../i18n";
import { ModifiedTimeFormatProvider } from "../settings/ModifiedTimeFormatProvider";
import { ListingSortOrderProvider } from "../settings/ListingSortOrderProvider";
import { ShowDotEntriesProvider } from "../settings/ShowDotEntriesProvider";
import { AppRouteProvider } from "../routing/AppRouteProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../index.css";

bootstrapSessionFromUrl();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <AppRouteProvider>
        <ModifiedTimeFormatProvider>
          <ListingSortOrderProvider>
            <ShowDotEntriesProvider>
              <ExplorerBackendProvider>
                <TooltipProvider>
                  <AppShell />
                </TooltipProvider>
              </ExplorerBackendProvider>
            </ShowDotEntriesProvider>
          </ListingSortOrderProvider>
        </ModifiedTimeFormatProvider>
      </AppRouteProvider>
    </I18nProvider>
  </React.StrictMode>,
);
