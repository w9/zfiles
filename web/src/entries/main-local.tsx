import React from "react";
import ReactDOM from "react-dom/client";

import { stripShareTokenFromUrl } from "../api";
import AppShell from "../AppShell";
import { ExplorerBackendProvider } from "../backend";
import { ExplorerSettingsProviders } from "../ExplorerSettingsProviders";
import { I18nProvider } from "../i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../index.css";

stripShareTokenFromUrl();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <ExplorerSettingsProviders bootMode="local">
        <ExplorerBackendProvider>
          <TooltipProvider>
            <AppShell />
          </TooltipProvider>
        </ExplorerBackendProvider>
      </ExplorerSettingsProviders>
    </I18nProvider>
  </React.StrictMode>,
);
