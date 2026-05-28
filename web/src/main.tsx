import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { bootstrapSessionFromUrl } from "./api";
import { ExplorerBackendProvider } from "./backend";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./i18n";
import "./index.css";

bootstrapSessionFromUrl();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <ExplorerBackendProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ExplorerBackendProvider>
    </I18nProvider>
  </React.StrictMode>,
);
