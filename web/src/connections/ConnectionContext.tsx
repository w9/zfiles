import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { ExplorerBackendProvider } from "@/backend";
import { BrowserBackend, createBrowserBackend } from "@/backend/browserBackend";
import { createKernelBackend } from "@/backend/kernelBackend";
import { createS3Backend, validateS3Connection } from "@/backend/s3Backend";
import type { ExplorerBackend } from "@/backend/types";
import { CloudAuthProvider } from "@/cloud/CloudAuthContext";
import { toCloudCredentialsAuthError } from "@/cloud/s3AuthError";
import type { S3ConnectionConfig, S3Credentials } from "@/cloud/types";
import { explorerHistoryHrefForPath } from "@/explorer/explorerUrl";
import { useTranslation } from "@/i18n";
import ConnectionDialog, { connectionDisplayName } from "./ConnectionDialog";
import ConnectionEditorDialog, {
  type ConnectionEditorMode,
  type ConnectionFormValues,
} from "./ConnectionEditorDialog";
import {
  BROWSER_CONNECTION_ID,
  browserConnection,
  createConnectionRegistry,
  kernelConnection,
  type ConnectionRegistry,
} from "./registry";
import type { ConnectionRecord } from "./types";

export type ConnectionMode = "local" | "cloud";

type ActiveConnection = {
  record: ConnectionRecord;
  backend: ExplorerBackend;
};

type DialogState =
  | { view: "list" }
  | { view: "editor"; mode: ConnectionEditorMode; id?: string }
  | null;

export type ConnectionContextValue = {
  mode: ConnectionMode;
  connections: ConnectionRecord[];
  active: ConnectionRecord;
  activating: boolean;
  authExpired: boolean;
  /** Only the cloud build can add or edit connections; the CLI serves one directory. */
  manageable: boolean;
  openConnections: () => void;
  openNewConnection: () => void;
  reconnectActive: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function useConnections(): ConnectionContextValue | null {
  return useContext(ConnectionContext);
}

function initialActive(mode: ConnectionMode): ActiveConnection {
  return mode === "cloud"
    ? { record: browserConnection(), backend: createBrowserBackend() }
    : { record: kernelConnection(), backend: createKernelBackend() };
}

function settingsFromForm(values: ConnectionFormValues) {
  return {
    provider: values.provider,
    bucket: values.bucket.trim(),
    region: values.region.trim(),
    endpoint: values.endpoint.trim() || undefined,
    prefix: values.prefix.trim(),
    readOnly: values.readOnly,
  };
}

function credentialsFromForm(values: ConnectionFormValues): S3Credentials {
  return {
    accessKeyId: values.accessKeyId.trim(),
    secretAccessKey: values.secretAccessKey.trim(),
    sessionToken: values.sessionToken.trim() || undefined,
  };
}

type ConnectionProviderProps = {
  mode: ConnectionMode;
  registry?: ConnectionRegistry;
  children: ReactNode;
};

/**
 * Owns the list of volumes and the one that is currently mounted. Switching swaps the
 * backend and remounts the explorer, which resets its path to the new volume's root.
 */
export function ConnectionProvider({
  mode,
  registry: injectedRegistry,
  children,
}: ConnectionProviderProps) {
  const { t } = useTranslation();
  const registry = useMemo(
    () => (mode === "cloud" ? (injectedRegistry ?? createConnectionRegistry()) : null),
    [injectedRegistry, mode],
  );
  const [connections, setConnections] = useState<ConnectionRecord[]>(() =>
    registry ? registry.list() : [kernelConnection()],
  );
  const [active, setActive] = useState<ActiveConnection>(() => initialActive(mode));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [activating, setActivating] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const activeRef = useRef(active);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const restoreAttempted = useRef(false);

  const refreshConnections = useCallback(() => {
    setConnections(registry ? registry.list() : [kernelConnection()]);
  }, [registry]);

  const mount = useCallback((next: ActiveConnection) => {
    const previous = activeRef.current;
    if (previous.backend === next.backend) {
      return;
    }
    if (previous.record.id !== next.record.id && typeof window !== "undefined") {
      window.history.replaceState(null, "", explorerHistoryHrefForPath(""));
    }
    activeRef.current = next;
    setActive(next);
    if (previous.backend instanceof BrowserBackend) {
      previous.backend.dispose();
    }
  }, []);

  const handleAuthError = useCallback(
    (error: unknown): boolean => {
      if (!toCloudCredentialsAuthError(error)) {
        return false;
      }
      const current = activeRef.current.record;
      if (current.kind !== "s3") {
        return false;
      }
      registry?.dropCredentials(current.id);
      setAuthExpired(true);
      return true;
    },
    [registry],
  );

  const activate = useCallback(
    async (id: string, credentials?: S3Credentials): Promise<void> => {
      const record =
        registry?.get(id) ?? (id === kernelConnection().id ? kernelConnection() : null);
      if (!record) {
        throw new Error(`unknown connection: ${id}`);
      }

      if (record.kind !== "s3") {
        registry?.setActive(record.id);
        refreshConnections();
        mount({
          record,
          backend:
            record.kind === "browser" ? createBrowserBackend() : createKernelBackend(),
        });
        setAuthExpired(false);
        return;
      }

      const settings = record.settings;
      if (!settings) {
        throw new Error(`connection is missing settings: ${id}`);
      }
      const keys = credentials ?? registry?.credentials(id) ?? null;
      if (!keys) {
        setDialog({ view: "editor", mode: "credentials", id });
        return;
      }

      const config: S3ConnectionConfig = { ...settings, credentials: keys };
      setActivating(true);
      try {
        await validateS3Connection(config);
        registry?.saveCredentials(id, keys, record.rememberKeys);
        registry?.setActive(id);
        refreshConnections();
        mount({ record, backend: createS3Backend(config, { onAuthError: handleAuthError }) });
        setAuthExpired(false);
      } finally {
        setActivating(false);
      }
    },
    [handleAuthError, mount, refreshConnections, registry],
  );

  // Reconnect to whatever was active last time, but only when we already hold its keys.
  useEffect(() => {
    if (!registry || restoreAttempted.current) {
      return;
    }
    restoreAttempted.current = true;
    const id = registry.activeId();
    if (id === BROWSER_CONNECTION_ID) {
      return;
    }
    const record = registry.get(id);
    if (record?.kind !== "s3" || !registry.credentials(id)) {
      return;
    }
    void activate(id).catch(() => {
      registry.setActive(BROWSER_CONNECTION_ID);
      refreshConnections();
      toast.error(t("connections.restoreFailed", { name: record.name }));
    });
  }, [activate, refreshConnections, registry, t]);

  const activateFromDialog = useCallback(
    (id: string) => {
      const name = registry?.get(id)?.name ?? id;
      void activate(id)
        .then(() => {
          if (dialogRef.current?.view === "list") {
            setDialog(null);
          }
        })
        .catch(() => {
          toast.error(t("connections.switchFailed", { name }));
        });
    },
    [activate, registry, t],
  );

  const submitEditor = useCallback(
    async (values: ConnectionFormValues) => {
      const state = dialogRef.current;
      if (!registry || state?.view !== "editor") {
        return;
      }
      const settings = settingsFromForm(values);
      const credentials = credentialsFromForm(values);

      if (state.mode === "create") {
        await validateS3Connection({ ...settings, credentials });
        const record = registry.create({
          name: values.name,
          settings,
          credentials,
          rememberKeys: values.rememberKeys,
        });
        refreshConnections();
        await activate(record.id, credentials);
        setDialog(null);
        return;
      }

      if (!state.id) {
        return;
      }

      if (state.mode === "edit") {
        const hasKeys = credentials.accessKeyId !== "" && credentials.secretAccessKey !== "";
        registry.update(state.id, {
          name: values.name,
          settings,
          rememberKeys: values.rememberKeys,
          credentials: hasKeys ? credentials : undefined,
        });
        refreshConnections();
        setDialog(null);
        return;
      }

      if (values.rememberKeys) {
        registry.update(state.id, { rememberKeys: true });
      }
      await activate(state.id, credentials);
      refreshConnections();
      setDialog(null);
    },
    [activate, refreshConnections, registry],
  );

  const editorInitial = useMemo((): Partial<ConnectionFormValues> | undefined => {
    if (dialog?.view !== "editor" || !dialog.id) {
      return undefined;
    }
    const record = registry?.get(dialog.id);
    if (!record?.settings) {
      return undefined;
    }
    return {
      name: record.name,
      provider: record.settings.provider,
      bucket: record.settings.bucket,
      region: record.settings.region,
      endpoint: record.settings.endpoint ?? "",
      prefix: record.settings.prefix,
      readOnly: record.settings.readOnly,
      rememberKeys: record.rememberKeys,
    };
  }, [dialog, registry]);

  const value = useMemo<ConnectionContextValue>(
    () => ({
      mode,
      connections,
      active: active.record,
      activating,
      authExpired,
      manageable: registry != null,
      openConnections: () => setDialog({ view: "list" }),
      openNewConnection: () => setDialog({ view: "editor", mode: "create" }),
      reconnectActive: () => {
        const current = activeRef.current.record;
        setDialog(
          current.kind === "s3"
            ? { view: "editor", mode: "credentials", id: current.id }
            : { view: "list" },
        );
      },
    }),
    [active.record, activating, authExpired, connections, mode, registry],
  );

  return (
    <ConnectionContext.Provider value={value}>
      <ExplorerBackendProvider key={active.record.id} backend={active.backend}>
        <CloudAuthProvider
          expired={authExpired}
          handleAuthError={handleAuthError}
          onReconnect={value.reconnectActive}
        >
          {children}
        </CloudAuthProvider>
      </ExplorerBackendProvider>

      {dialog?.view === "list" ? (
        <ConnectionDialog
          open
          connections={connections}
          activeId={active.record.id}
          manageable={registry != null}
          busy={activating}
          hasStoredCredentials={(id) => registry?.hasStoredCredentials(id) ?? false}
          onActivate={activateFromDialog}
          onCreate={() => setDialog({ view: "editor", mode: "create" })}
          onEdit={(id) => setDialog({ view: "editor", mode: "edit", id })}
          onDuplicate={(id) => {
            registry?.duplicate(id);
            refreshConnections();
          }}
          onForgetKeys={(id) => {
            registry?.forgetCredentials(id);
            refreshConnections();
          }}
          onRemove={(id) => {
            registry?.remove(id);
            refreshConnections();
            if (activeRef.current.record.id === id) {
              void activate(BROWSER_CONNECTION_ID);
            }
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.view === "editor" ? (
        <ConnectionEditorDialog
          key={`${dialog.mode}:${dialog.id ?? "new"}`}
          open
          mode={dialog.mode}
          initial={editorInitial}
          onCancel={() => setDialog(null)}
          onSubmit={submitEditor}
        />
      ) : null}
    </ConnectionContext.Provider>
  );
}

export { connectionDisplayName };
