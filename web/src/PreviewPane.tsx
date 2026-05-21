import { useEffect, useRef, useState } from "react";

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
};

type PreviewPaneProps = {
  path: string | null;
  plugins: PluginInfo[];
};

type ViewerModule = {
  mount?: (container: HTMLElement, context: { path: string; body: string }) => void;
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

export default function PreviewPane({ path, plugins }: PreviewPaneProps) {
  const [stat, setStat] = useState<FileStat | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esmMounted, setEsmMounted] = useState(false);
  const slotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!path) {
      setStat(null);
      setPreview(null);
      setError(null);
      setEsmMounted(false);
      return;
    }

    setPreview(null);
    setEsmMounted(false);
    fetch(`/api/stat?path=${encodeURIComponent(path)}`)
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
      fetch(`/api/preview?path=${encodeURIComponent(path)}`)
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
    if (!path || preview == null || !slotRef.current) {
      setEsmMounted(false);
      return;
    }

    const viewer = viewerFor(plugins, path);
    if (!viewer?.viewerModule) {
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
      })
      .catch(() => setEsmMounted(false));

    return () => {
      cancelled = true;
    };
  }, [path, preview, plugins]);

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
            </p>
          ) : null}
          <div ref={slotRef} className="viewer-mount" />
          {!esmMounted && preview != null ? (
            <pre className="preview-text">{preview}</pre>
          ) : null}
          {!esmMounted && preview == null ? (
            <p className="meta">No viewer plugin registered for this file type.</p>
          ) : null}
          <a href={`/api/file?path=${encodeURIComponent(stat.path)}`}>Download</a>
        </div>
      ) : null}
    </aside>
  );
}
