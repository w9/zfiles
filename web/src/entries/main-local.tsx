import React from "react";
import ReactDOM from "react-dom/client";

import { bootstrapSessionFromUrl } from "../api";
import { ExplorerBackendProvider } from "../backend";
import { ExplorerApp } from "../explorer";
import { I18nProvider } from "../i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../index.css";

bootstrapSessionFromUrl();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <ExplorerBackendProvider>
        <TooltipProvider>
          <ExplorerApp />
        </TooltipProvider>
      </ExplorerBackendProvider>
    </I18nProvider>
  </React.StrictMode>,
);
