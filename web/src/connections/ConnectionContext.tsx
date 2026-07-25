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
import {
  readBootRequestFromUrl,
  stripBootCredentialsFromUrl,
  type BootRequest,
} from "@/cloud/bootParams";
import { toCloudCredentialsAuthError } from "@/cloud/s3AuthError";
import type {
  S3BootParams,
  S3ConnectionConfig,
  S3ConnectionSettings,
  S3Credentials,
} from "@/cloud/types";
import { defaultStorageManager, readStorageEstimate } from "@/browserfs/quota";
import { explorerHistoryHrefForPath } from "@/explorer/explorerUrl";
import { useTranslation } from "@/i18n";
import ConnectionDialog, { connectionDisplayName } from "./ConnectionDialog";
import ConnectionEditorDialog, {
  type ConnectionEditorMode,
  type ConnectionFormValues,
} from "./ConnectionEditorDialog";
import ConnectionFailureDialog from "./ConnectionFailureDialog";
import {
  BROWSER_CONNECTION_ID,
  browserConnection,
  createConnectionRegistry,
  kernelConnection,
  type ConnectionRegistry,
} from "./registry";
import type { ConnectionRecord } from "./types";

/** A connection described entirely by the URL; it is not saved unless the user asks. */
export const EPHEMERAL_CONNECTION_ID = "url";

export type ConnectionMode = "local" | "cloud";

type ActiveConnection = {
  record: ConnectionRecord;
  backend: ExplorerBackend;
};

type EphemeralConnection = {
  record: ConnectionRecord;
  credentials: S3Credentials;
};

type DialogState =
  | { view: "list" }
  | {
      view: "editor";
      mode: ConnectionEditorMode;
      id?: string;
      initial?: Partial<ConnectionFormValues>;
    }
  | null;

type FailureState = {
  id: string;
  name: string;
  message: string | null;
  allowCancel: boolean;
};

export type ConnectionContextValue = {
  mode: ConnectionMode;
  connections: ConnectionRecord[];
  active: ConnectionRecord;
  activating: boolean;
  authExpired: boolean;
  /** True while a failed connection keeps its last listing on screen with actions disabled. */
  frozen: boolean;
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

function settingsFromForm(values: ConnectionFormValues): S3ConnectionSettings {
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

function settingsFromBootParams(params: S3BootParams): S3ConnectionSettings {
  return {
    provider: params.provider ?? "aws",
    bucket: params.bucket?.trim() ?? "",
    region: params.region?.trim() || "us-east-1",
    endpoint: params.endpoint?.trim() || undefined,
    prefix: params.prefix?.trim() ?? "",
    readOnly: params.readOnly ?? false,
  };
}

function credentialsFromBootParams(params: S3BootParams): S3Credentials | null {
  const accessKeyId = params.accessKeyId?.trim();
  const secretAccessKey = params.secretAccessKey?.trim();
  if (!accessKeyId || !secretAccessKey) {
    return null;
  }
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: params.sessionToken?.trim() || undefined,
  };
}

function canConnectFromBootParams(
  settings: S3ConnectionSettings,
  credentials: S3Credentials | null,
): boolean {
  if (!settings.bucket || !credentials) {
    return false;
  }
  return settings.provider !== "r2" || Boolean(settings.endpoint);
}

function bootParamsToFormValues(params: S3BootParams): Partial<ConnectionFormValues> {
  const settings = settingsFromBootParams(params);
  return {
    provider: settings.provider,
    bucket: settings.bucket,
    region: settings.region,
    endpoint: settings.endpoint ?? "",
    prefix: settings.prefix,
    readOnly: settings.readOnly,
    accessKeyId: params.accessKeyId ?? "",
    secretAccessKey: params.secretAccessKey ?? "",
    sessionToken: params.sessionToken ?? "",
  };
}

function errorMessage(err: unknown): string | null {
  if (err instanceof Error) {
    return err.message;
  }
  return err == null ? null : String(err);
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
  const [saved, setSaved] = useState<ConnectionRecord[]>(() =>
    registry ? registry.list() : [kernelConnection()],
  );
  const [ephemeral, setEphemeral] = useState<EphemeralConnection | null>(null);
  const [active, setActive] = useState<ActiveConnection>(() => initialActive(mode));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [failure, setFailure] = useState<FailureState | null>(null);
  const [activating, setActivating] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [browserUsageBytes, setBrowserUsageBytes] = useState<number | null>(null);
  const activeRef = useRef(active);
  const ephemeralRef = useRef(ephemeral);
  ephemeralRef.current = ephemeral;
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const bootResolved = useRef(false);

  const connections = useMemo(
    () => (ephemeral ? [...saved, ephemeral.record] : saved),
    [ephemeral, saved],
  );

  const refreshSaved = useCallback(() => {
    setSaved(registry ? registry.list() : [kernelConnection()]);
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

  const recordFor = useCallback(
    (id: string): ConnectionRecord | null => {
      if (id === EPHEMERAL_CONNECTION_ID) {
        return ephemeralRef.current?.record ?? null;
      }
      return registry?.get(id) ?? (id === kernelConnection().id ? kernelConnection() : null);
    },
    [registry],
  );

  const credentialsFor = useCallback(
    (id: string): S3Credentials | null => {
      if (id === EPHEMERAL_CONNECTION_ID) {
        return ephemeralRef.current?.credentials ?? null;
      }
      return registry?.credentials(id) ?? null;
    },
    [registry],
  );

  const handleAuthError = useCallback(
    (error: unknown): boolean => {
      if (!toCloudCredentialsAuthError(error)) {
        return false;
      }
      const current = activeRef.current.record;
      if (current.kind !== "s3") {
        return false;
      }
      if (current.id !== EPHEMERAL_CONNECTION_ID) {
        registry?.dropCredentials(current.id);
      }
      setAuthExpired(true);
      setFrozen(true);
      setFailure((existing) =>
        existing ?? {
          id: current.id,
          name: current.name,
          message: null,
          allowCancel: true,
        },
      );
      return true;
    },
    [registry],
  );

  const activate = useCallback(
    async (id: string, credentials?: S3Credentials): Promise<void> => {
      const record = recordFor(id);
      if (!record) {
        throw new Error(`unknown connection: ${id}`);
      }

      if (record.kind !== "s3") {
        registry?.setActive(record.id);
        refreshSaved();
        mount({
          record,
          backend:
            record.kind === "browser" ? createBrowserBackend() : createKernelBackend(),
        });
        setAuthExpired(false);
        setFrozen(false);
        setFailure(null);
        return;
      }

      const settings = record.settings;
      if (!settings) {
        throw new Error(`connection is missing settings: ${id}`);
      }
      const keys = credentials ?? credentialsFor(id);
      if (!keys) {
        setDialog({ view: "editor", mode: "credentials", id });
        return;
      }

      const config: S3ConnectionConfig = { ...settings, credentials: keys };
      setActivating(true);
      try {
        await validateS3Connection(config);
        if (record.id === EPHEMERAL_CONNECTION_ID) {
          setEphemeral({ record, credentials: keys });
        } else {
          registry?.saveCredentials(id, keys, record.rememberKeys);
          registry?.setActive(id);
          refreshSaved();
        }
        mount({ record, backend: createS3Backend(config, { onAuthError: handleAuthError }) });
        setAuthExpired(false);
        setFrozen(false);
        setFailure(null);
      } finally {
        setActivating(false);
      }
    },
    [credentialsFor, handleAuthError, mount, recordFor, refreshSaved, registry],
  );

  const saveEphemeral = useCallback(() => {
    const current = ephemeralRef.current;
    if (!registry || !current?.record.settings) {
      return;
    }
    const created = registry.create({
      name: current.record.name,
      settings: current.record.settings,
      credentials: current.credentials,
      rememberKeys: false,
    });
    setEphemeral(null);
    refreshSaved();
    void activate(created.id, current.credentials).catch(() => {
      toast.error(t("connections.switchFailed", { name: created.name }));
    });
  }, [activate, refreshSaved, registry, t]);

  const connectFromUrl = useCallback(
    async (settings: S3ConnectionSettings, credentials: S3Credentials) => {
      const record: ConnectionRecord = {
        id: EPHEMERAL_CONNECTION_ID,
        kind: "s3",
        name: settings.bucket || t("connections.urlConnection"),
        createdAt: Date.now(),
        rememberKeys: false,
        ephemeral: true,
        settings,
      };
      ephemeralRef.current = { record, credentials };
      await activate(EPHEMERAL_CONNECTION_ID, credentials);
      toast.success(t("connections.urlConnected", { name: record.name }), {
        action: {
          label: t("connections.saveConnection"),
          onClick: saveEphemeral,
        },
      });
    },
    [activate, saveEphemeral, t],
  );

  const failFromBoot = useCallback((id: string, name: string, err: unknown) => {
    setFailure({ id, name, message: errorMessage(err), allowCancel: false });
  }, []);

  const resolveBootRequest = useCallback(
    async (request: BootRequest) => {
      if (!registry) {
        return;
      }
      const { intent, params } = request;

      if (intent?.kind === "ask") {
        setDialog({ view: "list" });
        return;
      }

      if (intent?.kind === "new") {
        const settings = settingsFromBootParams(params);
        const credentials = credentialsFromBootParams(params);
        if (!canConnectFromBootParams(settings, credentials)) {
          setDialog({
            view: "editor",
            mode: "create",
            initial: bootParamsToFormValues(params),
          });
          return;
        }
        await connectFromUrl(settings, credentials!).catch((err: unknown) => {
          failFromBoot(EPHEMERAL_CONNECTION_ID, settings.bucket, err);
        });
        return;
      }

      if (intent?.kind === "saved") {
        const record = registry.findByName(intent.name);
        if (!record) {
          toast.error(t("connections.unknownSaved", { name: intent.name }));
          return;
        }
        await activate(record.id).catch((err: unknown) => {
          failFromBoot(record.id, record.name, err);
        });
        return;
      }

      // No intent: reconnect to whatever was active last, if we still hold its keys.
      const rememberedId = registry.activeId();
      if (rememberedId === BROWSER_CONNECTION_ID) {
        return;
      }
      const remembered = registry.get(rememberedId);
      if (remembered?.kind !== "s3" || !registry.credentials(rememberedId)) {
        return;
      }
      await activate(rememberedId).catch((err: unknown) => {
        failFromBoot(rememberedId, remembered.name, err);
      });
    },
    [activate, connectFromUrl, failFromBoot, registry, t],
  );

  // Origin-wide usage, so it works whether or not Browser storage is the active volume.
  useEffect(() => {
    if (dialog?.view !== "list") {
      return;
    }
    let cancelled = false;
    void readStorageEstimate(defaultStorageManager()).then((estimate) => {
      if (!cancelled) {
        setBrowserUsageBytes(estimate?.usage ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dialog]);

  useEffect(() => {
    if (!registry || bootResolved.current) {
      return;
    }
    bootResolved.current = true;
    const request = readBootRequestFromUrl();
    stripBootCredentialsFromUrl();
    void resolveBootRequest(request);
  }, [registry, resolveBootRequest]);

  const activateFromDialog = useCallback(
    (id: string) => {
      const name = recordFor(id)?.name ?? id;
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
    [activate, recordFor, t],
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
        refreshSaved();
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
        refreshSaved();
        setDialog(null);
        return;
      }

      if (values.rememberKeys && state.id !== EPHEMERAL_CONNECTION_ID) {
        registry.update(state.id, { rememberKeys: true });
      }
      await activate(state.id, credentials);
      refreshSaved();
      setDialog(null);
    },
    [activate, refreshSaved, registry],
  );

  const editorInitial = useMemo((): Partial<ConnectionFormValues> | undefined => {
    if (dialog?.view !== "editor") {
      return undefined;
    }
    if (dialog.initial) {
      return dialog.initial;
    }
    if (!dialog.id) {
      return undefined;
    }
    const record = recordFor(dialog.id);
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
  }, [dialog, recordFor]);

  const retryFailure = useCallback(() => {
    const current = failure;
    if (!current) {
      return;
    }
    setFailure(null);
    void activate(current.id).catch((err: unknown) => {
      setFailure({ ...current, message: errorMessage(err) });
    });
  }, [activate, failure]);

  const value = useMemo<ConnectionContextValue>(
    () => ({
      mode,
      connections,
      active: active.record,
      activating,
      authExpired,
      frozen,
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
    [active.record, activating, authExpired, connections, frozen, mode, registry],
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
          browserUsageBytes={browserUsageBytes}
          hasStoredCredentials={(id) => registry?.hasStoredCredentials(id) ?? false}
          onActivate={activateFromDialog}
          onCreate={() => setDialog({ view: "editor", mode: "create" })}
          onEdit={(id) => setDialog({ view: "editor", mode: "edit", id })}
          onDuplicate={(id) => {
            registry?.duplicate(id);
            refreshSaved();
          }}
          onForgetKeys={(id) => {
            registry?.forgetCredentials(id);
            refreshSaved();
          }}
          onRemove={(id) => {
            registry?.remove(id);
            refreshSaved();
            if (activeRef.current.record.id === id) {
              void activate(BROWSER_CONNECTION_ID);
            }
          }}
          onSaveEphemeral={saveEphemeral}
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

      {failure && !dialog ? (
        <ConnectionFailureDialog
          open
          name={failure.name}
          message={failure.message}
          allowCancel={failure.allowCancel}
          busy={activating}
          onRetry={retryFailure}
          onUseDifferent={() => {
            setFailure(null);
            setDialog({ view: "list" });
          }}
          onCancel={() => setFailure(null)}
        />
      ) : null}
    </ConnectionContext.Provider>
  );
}

export { connectionDisplayName };
