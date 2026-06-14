import { useCallback, useMemo, useState } from "react";

import AppShell from "@/AppShell";
import { ExplorerBackendProvider } from "@/backend";
import { createS3Backend, type S3Backend } from "@/backend/s3Backend";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n";
import { CloudDisconnectProvider } from "./CloudDisconnectContext";
import { ModifiedTimeFormatProvider } from "@/settings/ModifiedTimeFormatProvider";
import { GridCardSizeProvider } from "@/settings/GridCardSizeProvider";
import { ListingSortOrderProvider } from "@/settings/ListingSortOrderProvider";
import { GridImagePreviewsProvider } from "@/settings/GridImagePreviewsProvider";
import { GridThumbnailBadgeProvider } from "@/settings/GridThumbnailBadgeProvider";
import { SlideshowSettingsProvider } from "@/settings/SlideshowSettingsProvider";
import { ShowDotEntriesProvider } from "@/settings/ShowDotEntriesProvider";
import { AppRouteProvider } from "@/routing/AppRouteProvider";
import ConnectDialog from "./ConnectDialog";
import { readBootParamsFromUrl, stripCredentialParamsFromUrl } from "./bootParams";
import {
  clearScopedMultipartRecords,
  multipartSessionScopeId,
  readScopedMultipartRecords,
} from "./multipartSessions";
import { removeStoredFileHandle } from "./multipartFileHandles";
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
  return (
    <CloudDisconnectProvider onDisconnect={onDisconnect}>
      <ExplorerBackendProvider backend={backend}>
        <AppShell />
      </ExplorerBackendProvider>
    </CloudDisconnectProvider>
  );
}

export default function CloudApp() {
  const bootParams = useMemo(() => {
    const params = readBootParamsFromUrl();
    stripCredentialParamsFromUrl();
    return params;
  }, []);
  const [backend, setBackend] = useState<S3Backend | null>(() => backendFromSession());

  const onDisconnect = useCallback(() => {
    setBackend((current) => {
      if (current) {
        const scopeId = multipartSessionScopeId(current.connectionConfig);
        const records = readScopedMultipartRecords(scopeId);
        clearScopedMultipartRecords(scopeId);
        void Promise.all(
          records.map((record) => removeStoredFileHandle(scopeId, record.uploadId)),
        );
      }
      clearSessionConfig();
      return null;
    });
  }, []);

  if (!backend) {
    return (
      <I18nProvider>
        <TooltipProvider>
          <ConnectDialog open bootParams={bootParams} onConnected={setBackend} />
          <Toaster richColors closeButton position="bottom-right" />
        </TooltipProvider>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      <AppRouteProvider>
        <ModifiedTimeFormatProvider>
          <GridCardSizeProvider>
            <ListingSortOrderProvider>
              <ShowDotEntriesProvider>
                <GridImagePreviewsProvider bootMode="cloud">
                  <GridThumbnailBadgeProvider bootMode="cloud">
                    <SlideshowSettingsProvider>
                      <TooltipProvider>
                        <ConnectedCloudShell backend={backend} onDisconnect={onDisconnect} />
                      </TooltipProvider>
                    </SlideshowSettingsProvider>
                  </GridThumbnailBadgeProvider>
                </GridImagePreviewsProvider>
              </ShowDotEntriesProvider>
            </ListingSortOrderProvider>
          </GridCardSizeProvider>
        </ModifiedTimeFormatProvider>
      </AppRouteProvider>
    </I18nProvider>
  );
}
