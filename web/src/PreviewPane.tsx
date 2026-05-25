import { useCallback, useEffect, useRef, useState } from "react";

import { Info, TriangleAlertIcon } from "lucide-react";

import { apiFetch } from "./api";
import { messageFromApiResponse } from "./apiError";
import { useTranslation } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ResolvedTheme } from "./theme";

type FileStat = {
  path: string;
  is_dir: boolean;
  size: number;
  modified?: string;
};

type PluginInfo = {
  name: string;
  capabilities: string[];
  globs: string[];
  viewerModule?: string | null;
  trusted?: boolean;
};

import { clearViewerBridge } from "./viewerBridge";
import type { ViewerBridge } from "./viewerBridge";

type PreviewPaneProps = {
  path: string | null;
  plugins: PluginInfo[];
  theme: ResolvedTheme;
  onFocusPreview?: () => void;
  onDispatch?: (actionId: string) => void;
  onRegisterBridge?: (bridge: ViewerBridge) => void;
  className?: string;
};

type ViewerModule = {
  mount?: (
    container: HTMLElement,
    context: {
      path: string;
      body: string;
      dispatch?: (actionId: string) => void;
      registerBridge?: (bridge: ViewerBridge) => void;
    },
  ) => void;
};

type SandboxPreviewPayload = {
  path: string;
  body: string;
};

function matchesGlob(glob: string, name: string): boolean {
  if (glob === "*") {
    return true;
  }
  if (glob.startsWith("*.")) {
    const ext = glob.slice(2);
    return name.endsWith(`.${ext}`) || name === ext;
  }
  return glob === name;
}

function viewerFor(plugins: PluginInfo[], path: string): PluginInfo | undefined {
  const name = path.split("/").pop() ?? path;
  return plugins.find(
    (plugin) =>
      plugin.capabilities.includes("viewer") &&
      plugin.globs.some((glob) => matchesGlob(glob, name)),
  );
}

function deliverSandboxPreview(
  iframe: HTMLIFrameElement,
  payload: SandboxPreviewPayload,
  onReady: () => void,
): () => void {
  let delivered = false;
  const send = () => {
    if (delivered) {
      return;
    }
    delivered = true;
    iframe.contentWindow?.postMessage(
      { type: "preview", path: payload.path, body: payload.body },
      window.location.origin,
    );
    onReady();
  };

  const sandboxLoaded = () =>
    iframe.contentWindow?.location.pathname.endsWith("/viewer-sandbox.html") ?? false;

  iframe.addEventListener("load", send, { once: true });
  if (sandboxLoaded()) {
    send();
  }

  return () => iframe.removeEventListener("load", send);
}

function deliverSandboxTheme(iframe: HTMLIFrameElement, theme: ResolvedTheme): void {
  iframe.contentWindow?.postMessage(
    { type: "theme", theme },
    window.location.origin,
  );
}

export default function PreviewPane({
  path,
  plugins,
  theme,
  onFocusPreview,
  onDispatch,
  onRegisterBridge,
  className,
}: PreviewPaneProps) {
  const { t } = useTranslation();
  const [stat, setStat] = useState<FileStat | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esmMounted, setEsmMounted] = useState(false);
  const [sandboxReady, setSandboxReady] = useState(false);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingSandboxPreviewRef = useRef<SandboxPreviewPayload | null>(null);

  const sandboxCleanupRef = useRef<(() => void) | null>(null);
  const viewerMountKeyRef = useRef<string | null>(null);
  const onDispatchRef = useRef(onDispatch);
  const onRegisterBridgeRef = useRef(onRegisterBridge);
  onDispatchRef.current = onDispatch;
  onRegisterBridgeRef.current = onRegisterBridge;

  const activeViewer = path ? viewerFor(plugins, path) : undefined;
  const viewerModule = activeViewer?.viewerModule ?? null;
  const viewerTrusted = activeViewer?.trusted ?? true;

  const tryDeliverSandboxPreview = useCallback(() => {
    const iframe = iframeRef.current;
    const payload = pendingSandboxPreviewRef.current;
    if (!iframe || !payload) {
      return;
    }
    sandboxCleanupRef.current?.();
    sandboxCleanupRef.current = deliverSandboxPreview(iframe, payload, () =>
      setSandboxReady(true),
    );
  }, []);

  const assignSandboxIframe = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      iframeRef.current = iframe;
      if (iframe) {
        deliverSandboxTheme(iframe, theme);
        tryDeliverSandboxPreview();
      }
    },
    [tryDeliverSandboxPreview, theme],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      deliverSandboxTheme(iframe, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!path) {
      sandboxCleanupRef.current?.();
      sandboxCleanupRef.current = null;
      pendingSandboxPreviewRef.current = null;
      setStat(null);
      setPreview(null);
      setError(null);
      setEsmMounted(false);
      setSandboxReady(false);
      clearViewerBridge();
      return;
    }

    setStat(null);
    setPreview(null);
    setEsmMounted(false);
    setSandboxReady(false);
    pendingSandboxPreviewRef.current = null;
    viewerMountKeyRef.current = null;

    apiFetch(`/api/metadata?path=${encodeURIComponent(path)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await messageFromApiResponse(response, t));
        }
        return response.json() as Promise<FileStat>;
      })
      .then((data) => {
        setStat(data);
        setError(null);
      })
      .catch((err: Error) => {
        setStat(null);
        setError(err.message);
      });
  }, [path, t]);

  useEffect(() => {
    if (!path || !viewerModule) {
      return;
    }

    apiFetch(`/api/preview?path=${encodeURIComponent(path)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((body) => setPreview(body))
      .catch(() => setPreview(null));
  }, [path, viewerModule]);

  const statReady = stat != null && stat.path === path;

  useEffect(() => {
    if (!path || !statReady) {
      pendingSandboxPreviewRef.current = null;
      setEsmMounted(false);
      setSandboxReady(false);
      clearViewerBridge();
      return;
    }

    if (!viewerModule) {
      pendingSandboxPreviewRef.current = null;
      setEsmMounted(false);
      setSandboxReady(false);
      clearViewerBridge();
      return;
    }

    const previewBody = preview ?? "";

    if (viewerTrusted === false) {
      setEsmMounted(false);
      pendingSandboxPreviewRef.current = { path, body: previewBody };
      tryDeliverSandboxPreview();
      return;
    }

    pendingSandboxPreviewRef.current = null;
    if (!slotRef.current) {
      return;
    }

    const mountKey = `${path}:${viewerModule}`;
    if (viewerMountKeyRef.current === mountKey) {
      setEsmMounted(true);
      return;
    }

    let cancelled = false;
    import(/* @vite-ignore */ viewerModule)
      .then((module: ViewerModule) => {
        if (cancelled || !slotRef.current) {
          return;
        }
        if (viewerMountKeyRef.current === mountKey) {
          return;
        }
        module.mount?.(slotRef.current, {
          path,
          body: "",
          dispatch: (actionId) => onDispatchRef.current?.(actionId),
          registerBridge: (bridge) => onRegisterBridgeRef.current?.(bridge),
        });
        viewerMountKeyRef.current = mountKey;
        setEsmMounted(true);
        setSandboxReady(false);
      })
      .catch(() => setEsmMounted(false));

    return () => {
      cancelled = true;
      clearViewerBridge();
      viewerMountKeyRef.current = null;
    };
  }, [path, statReady, viewerModule, viewerTrusted, tryDeliverSandboxPreview]);

  useEffect(() => {
    if (viewerTrusted !== false || !path || preview == null) {
      return;
    }
    pendingSandboxPreviewRef.current = { path, body: preview };
    tryDeliverSandboxPreview();
  }, [path, preview, viewerTrusted, tryDeliverSandboxPreview]);

  const shellClass = cn(
    "relative min-h-[320px] overflow-auto rounded-xl border bg-card p-4",
    className,
  );

  if (!path) {
    return (
      <aside className={shellClass} aria-label={t("preview.label")}>
        <p className="text-sm text-muted-foreground">{t("preview.selectFile")}</p>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className={shellClass} aria-label={t("preview.label")}>
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{t("preview.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </aside>
    );
  }

  if (!stat) {
    return (
      <aside className={shellClass} aria-label={t("preview.label")}>
        <p className="text-sm text-muted-foreground">{t("preview.loading")}</p>
      </aside>
    );
  }

  const viewer = viewerFor(plugins, stat.path);
  const sandboxed = viewer?.trusted === false && viewer.viewerModule != null;

  return (
    <aside
      className={shellClass}
      aria-label={t("preview.label")}
      onMouseDown={() => onFocusPreview?.()}
    >
      <h2 className="mb-3 text-lg font-semibold">{stat.path.split("/").pop()}</h2>
      <dl className="mb-4 grid gap-2 text-sm">
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <dt className="text-muted-foreground">{t("preview.path")}</dt>
          <dd className="break-all">{stat.path}</dd>
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <dt className="text-muted-foreground">{t("preview.type")}</dt>
          <dd>
            {stat.is_dir ? t("preview.type.directory") : t("preview.type.file")}
          </dd>
        </div>
        {!stat.is_dir ? (
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <dt className="text-muted-foreground">{t("preview.size")}</dt>
            <dd>{t("preview.bytes", { size: String(stat.size) })}</dd>
          </div>
        ) : null}
      </dl>
      {!stat.is_dir ? (
        <div className="space-y-3" data-viewer-slot="preview">
          {viewer?.viewerModule ? (
            <>
              {sandboxed ? (
                <iframe
                  ref={assignSandboxIframe}
                  className="h-64 w-full rounded-md border bg-background"
                  title={t("preview.sandboxTitle")}
                  sandbox="allow-scripts allow-same-origin"
                  src="/viewer-sandbox.html"
                />
              ) : (
                <div ref={slotRef} className="rounded-md border bg-background p-2" />
              )}
              {!sandboxed && !esmMounted && preview != null && preview.length > 0 ? (
                <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-sm">
                  {preview}
                </pre>
              ) : null}
              {!sandboxed && !esmMounted ? (
                <p className="text-sm text-muted-foreground">{t("preview.loading")}</p>
              ) : null}
              {sandboxed && !sandboxReady && preview != null ? (
                <p className="text-sm text-muted-foreground">{t("preview.loadingSandbox")}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("preview.noViewer")}</p>
          )}
          <Button variant="link" className="h-auto p-0" asChild>
            <a href={`/api/file?path=${encodeURIComponent(stat.path)}`}>
              {t("preview.download")}
            </a>
          </Button>
        </div>
      ) : null}
      {viewer?.viewerModule ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="absolute bottom-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-muted/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("preview.viewerInfo")}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" align="end" className="max-w-xs space-y-1 text-left">
            <p className="font-medium">{t("preview.viewerModule")}</p>
            <code className="block break-all font-mono text-[11px] leading-snug opacity-90">
              {viewer.viewerModule}
            </code>
            {sandboxed ? (
              <p className="text-[11px] opacity-90">{t("preview.sandboxed")}</p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </aside>
  );
}
