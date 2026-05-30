import { useCallback, useMemo, useState } from "react";

import AppShell from "@/AppShell";
import { ExplorerBackendProvider } from "@/backend";
import { createS3Backend, type S3Backend } from "@/backend/s3Backend";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useTranslation } from "@/i18n";
import { ModifiedTimeFormatProvider } from "@/settings/ModifiedTimeFormatProvider";
import { ListingSortOrderProvider } from "@/settings/ListingSortOrderProvider";
import { ShowDotEntriesProvider } from "@/settings/ShowDotEntriesProvider";
import { AppRouteProvider } from "@/routing/AppRouteProvider";
import ConnectDialog from "./ConnectDialog";
import { readBootParamsFromUrl } from "./bootParams";
import { clearSessionConfig, loadSessionConfig } from "./credentials";

function backendFromSession(): S3Backend | null {
  const config = loadSessionConfig();
  return config ? createS3Backend(config) : null;
}

function ConnectedCloudShell({
  backend,
  onDisconnect,
}: {
  backend: S3Backend;
  onDisconnect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ExplorerBackendProvider backend={backend}>
      <div className="relative min-h-screen">
        <div className="absolute right-4 top-4 z-20">
          <Button type="button" variant="outline" size="sm" onClick={onDisconnect}>
            {t("connect.disconnect")}
          </Button>
        </div>
        <AppShell />
      </div>
    </ExplorerBackendProvider>
  );
}

export default function CloudApp() {
  const bootParams = useMemo(() => readBootParamsFromUrl(), []);
  const [backend, setBackend] = useState<S3Backend | null>(() => backendFromSession());

  const onDisconnect = useCallback(() => {
    clearSessionConfig();
    setBackend(null);
  }, []);

  if (!backend) {
    return (
      <I18nProvider>
        <TooltipProvider>
          <ConnectDialog open bootParams={bootParams} onConnected={setBackend} />
        </TooltipProvider>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      <AppRouteProvider>
        <ModifiedTimeFormatProvider>
          <ListingSortOrderProvider>
            <ShowDotEntriesProvider>
              <TooltipProvider>
                <ConnectedCloudShell backend={backend} onDisconnect={onDisconnect} />
              </TooltipProvider>
            </ShowDotEntriesProvider>
          </ListingSortOrderProvider>
        </ModifiedTimeFormatProvider>
      </AppRouteProvider>
    </I18nProvider>
  );
}
