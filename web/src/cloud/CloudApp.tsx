import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import AppShell from "@/AppShell";
import { ExplorerBackendProvider } from "@/backend";
import { createS3Backend, type S3Backend } from "@/backend/s3Backend";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useTranslation } from "@/i18n";
import { CloudAuthProvider } from "./CloudAuthContext";
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
import {
  clearSessionConfig,
  clearSessionCredentialsPreservingSettings,
  loadPreservedConnectionSettings,
  loadSessionConfig,
} from "./credentials";
import { toCloudCredentialsAuthError } from "./s3AuthError";
import type { S3BootParams, S3ConnectionConfig, S3ConnectionSettings } from "./types";

function settingsToBootParams(settings: S3ConnectionSettings): S3BootParams {
  return {
    provider: settings.provider,
    bucket: settings.bucket,
    region: settings.region,
    endpoint: settings.endpoint,
    prefix: settings.prefix,
    readOnly: settings.readOnly,
  };
}

function mergeBootParams(base: S3BootParams, override: S3BootParams): S3BootParams {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function ConnectedCloudShell({
  backend,
  onDisconnect,
  authExpired,
  onAuthError,
  onReconnect,
}: {
  backend: S3Backend;
  onDisconnect: () => void;
  authExpired: boolean;
  onAuthError: (error: unknown) => boolean;
  onReconnect: () => void;
}) {
  return (
    <CloudAuthProvider
      expired={authExpired}
      handleAuthError={onAuthError}
      onReconnect={onReconnect}
    >
      <CloudDisconnectProvider onDisconnect={onDisconnect}>
        <ExplorerBackendProvider backend={backend}>
          <AppShell />
        </ExplorerBackendProvider>
      </CloudDisconnectProvider>
    </CloudAuthProvider>
  );
}

function CloudAppContent() {
  const { t } = useTranslation();
  const bootParams = useMemo(() => {
    const params = readBootParamsFromUrl();
    stripCredentialParamsFromUrl();
    return params;
  }, []);
  const [connectionConfig, setConnectionConfig] = useState<S3ConnectionConfig | null>(
    () => loadSessionConfig(),
  );
  const [preservedSettings, setPreservedSettings] =
    useState<S3ConnectionSettings | null>(() => loadPreservedConnectionSettings());
  const [authExpired, setAuthExpired] = useState(false);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const authToastShownRef = useRef(false);

  const openReconnect = useCallback(() => {
    setReconnectOpen(true);
  }, []);

  const handleAuthError = useCallback(
    (error: unknown): boolean => {
      const authError = toCloudCredentialsAuthError(error);
      if (!authError || !connectionConfig) {
        return false;
      }

      const settings = clearSessionCredentialsPreservingSettings(connectionConfig);
      setPreservedSettings(settings);
      setAuthExpired(true);

      if (!authToastShownRef.current) {
        authToastShownRef.current = true;
        toast.error(t("connect.authExpired.toast"), {
          action: {
            label: t("connect.authExpired.reconnect"),
            onClick: openReconnect,
          },
        });
      }
      return true;
    },
    [connectionConfig, openReconnect, t],
  );

  const backend = useMemo(
    () =>
      connectionConfig
        ? createS3Backend(connectionConfig, { onAuthError: handleAuthError })
        : null,
    [connectionConfig, handleAuthError],
  );

  const connectBootParams = useMemo(() => {
    const preserved = preservedSettings ? settingsToBootParams(preservedSettings) : {};
    return mergeBootParams(preserved, bootParams);
  }, [bootParams, preservedSettings]);

  const onConnected = useCallback((config: S3ConnectionConfig) => {
    setConnectionConfig(config);
    setPreservedSettings(null);
    setAuthExpired(false);
    setReconnectOpen(false);
    authToastShownRef.current = false;
  }, []);

  const onDisconnect = useCallback(() => {
    setConnectionConfig((current) => {
      if (current) {
        const scopeId = multipartSessionScopeId(current);
        const records = readScopedMultipartRecords(scopeId);
        clearScopedMultipartRecords(scopeId);
        void Promise.all(
          records.map((record) => removeStoredFileHandle(scopeId, record.uploadId)),
        );
      }
      clearSessionConfig();
      setPreservedSettings(null);
      setAuthExpired(false);
      setReconnectOpen(false);
      authToastShownRef.current = false;
      return null;
    });
  }, []);

  if (!backend) {
    return (
      <TooltipProvider>
        <ConnectDialog open bootParams={connectBootParams} onConnected={onConnected} />
        <Toaster richColors closeButton position="bottom-right" />
      </TooltipProvider>
    );
  }

  return (
    <AppRouteProvider>
      <ModifiedTimeFormatProvider>
        <GridCardSizeProvider>
          <ListingSortOrderProvider>
            <ShowDotEntriesProvider>
              <GridImagePreviewsProvider bootMode="cloud">
                <GridThumbnailBadgeProvider bootMode="cloud">
                  <SlideshowSettingsProvider>
                    <TooltipProvider>
                      <ConnectedCloudShell
                        backend={backend}
                        onDisconnect={onDisconnect}
                        authExpired={authExpired}
                        onAuthError={handleAuthError}
                        onReconnect={openReconnect}
                      />
                      {reconnectOpen ? (
                        <ConnectDialog
                          open
                          bootParams={connectBootParams}
                          onConnected={onConnected}
                        />
                      ) : null}
                    </TooltipProvider>
                  </SlideshowSettingsProvider>
                </GridThumbnailBadgeProvider>
              </GridImagePreviewsProvider>
            </ShowDotEntriesProvider>
          </ListingSortOrderProvider>
        </GridCardSizeProvider>
      </ModifiedTimeFormatProvider>
    </AppRouteProvider>
  );
}

export default function CloudApp() {
  return (
    <I18nProvider>
      <CloudAppContent />
    </I18nProvider>
  );
}
