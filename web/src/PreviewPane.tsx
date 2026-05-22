import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "./api";

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

type PreviewPaneProps = {
  path: string | null;
  plugins: PluginInfo[];
};

type ViewerModule = {
  mount?: (container: HTMLElement, context: { path: string; body: string }) => void;
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

export default function PreviewPane({ path, plugins }: PreviewPaneProps) {
  const [stat, setStat] = useState<FileStat | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esmMounted, setEsmMounted] = useState(false);
  const [sandboxReady, setSandboxReady] = useState(false);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingSandboxPreviewRef = useRef<SandboxPreviewPayload | null>(null);

  const sandboxCleanupRef = useRef<(() => void) | null>(null);

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
        tryDeliverSandboxPreview();
      }
    },
    [tryDeliverSandboxPreview],
  );

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
      return;
    }

    pendingSandboxPreviewRef.current = null;
    setPreview(null);
    setEsmMounted(false);
    setSandboxReady(false);
    apiFetch(`/api/stat?path=${encodeURIComponent(path)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
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

    if (viewerFor(plugins, path)) {
      apiFetch(`/api/preview?path=${encodeURIComponent(path)}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.text();
        })
        .then((body) => setPreview(body))
        .catch(() => setPreview(null));
    }
  }, [path, plugins]);

  useEffect(() => {
    if (!path || preview == null || stat == null) {
      pendingSandboxPreviewRef.current = null;
      setEsmMounted(false);
      setSandboxReady(false);
      return;
    }

    const viewer = viewerFor(plugins, path);
    if (!viewer?.viewerModule) {
      pendingSandboxPreviewRef.current = null;
      setEsmMounted(false);
      setSandboxReady(false);
      return;
    }

    if (viewer.trusted === false) {
      setEsmMounted(false);
      pendingSandboxPreviewRef.current = { path, body: preview };
      tryDeliverSandboxPreview();
      return;
    }

    pendingSandboxPreviewRef.current = null;
    if (!slotRef.current) {
      setEsmMounted(false);
      return;
    }

    let cancelled = false;
    import(/* @vite-ignore */ viewer.viewerModule)
      .then((module: ViewerModule) => {
        if (cancelled || !slotRef.current) {
          return;
        }
        module.mount?.(slotRef.current, { path, body: preview });
        setEsmMounted(true);
        setSandboxReady(false);
      })
      .catch(() => setEsmMounted(false));

    return () => {
      cancelled = true;
    };
  }, [path, preview, plugins, stat, tryDeliverSandboxPreview]);

  if (!path) {
    return (
      <aside className="preview-pane" aria-label="Preview pane">
        <p className="meta">Select a file to preview metadata.</p>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="preview-pane" aria-label="Preview pane">
        <p className="error">{error}</p>
      </aside>
    );
  }

  if (!stat) {
    return (
      <aside className="preview-pane" aria-label="Preview pane">
        <p className="meta">Loading…</p>
      </aside>
    );
  }

  const viewer = viewerFor(plugins, stat.path);
  const sandboxed = viewer?.trusted === false && viewer.viewerModule != null;

  return (
    <aside className="preview-pane" aria-label="Preview pane">
      <h2>{stat.path.split("/").pop()}</h2>
      <dl className="preview-meta">
        <div>
          <dt>Path</dt>
          <dd>{stat.path}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{stat.is_dir ? "Directory" : "File"}</dd>
        </div>
        {!stat.is_dir ? (
          <div>
            <dt>Size</dt>
            <dd>{stat.size} B</dd>
          </div>
        ) : null}
      </dl>
      {!stat.is_dir ? (
        <div className="viewer-slot" data-viewer-slot="preview">
          {viewer?.viewerModule ? (
            <p className="meta viewer-module-hint">
              Viewer module: <code>{viewer.viewerModule}</code>
              {sandboxed ? " (sandboxed)" : null}
            </p>
          ) : null}
          {sandboxed ? (
            <iframe
              ref={assignSandboxIframe}
              className="viewer-sandbox"
              title="Sandboxed preview"
              sandbox="allow-scripts allow-same-origin"
              src="/viewer-sandbox.html"
            />
          ) : (
            <div ref={slotRef} className="viewer-mount" />
          )}
          {!sandboxed && !esmMounted && preview != null ? (
            <pre className="preview-text">{preview}</pre>
          ) : null}
          {!sandboxed && !esmMounted && preview == null ? (
            <p className="meta">No viewer plugin registered for this file type.</p>
          ) : null}
          {sandboxed && !sandboxReady && preview != null ? (
            <p className="meta">Loading sandboxed preview…</p>
          ) : null}
          <a href={`/api/file?path=${encodeURIComponent(stat.path)}`}>Download</a>
        </div>
      ) : null}
    </aside>
  );
}
