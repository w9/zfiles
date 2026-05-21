import { useEffect, useState } from "react";

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
};

type PreviewPaneProps = {
  path: string | null;
  plugins: PluginInfo[];
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

function hasViewer(plugins: PluginInfo[], path: string): boolean {
  const name = path.split("/").pop() ?? path;
  return plugins.some(
    (plugin) =>
      plugin.capabilities.includes("viewer") &&
      plugin.globs.some((glob) => matchesGlob(glob, name)),
  );
}

export default function PreviewPane({ path, plugins }: PreviewPaneProps) {
  const [stat, setStat] = useState<FileStat | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setStat(null);
      setPreview(null);
      setError(null);
      return;
    }

    setPreview(null);
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

    if (hasViewer(plugins, path)) {
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
          {preview != null ? (
            <pre className="preview-text">{preview}</pre>
          ) : (
            <p className="meta">No viewer plugin registered for this file type.</p>
          )}
          <a href={`/api/file?path=${encodeURIComponent(stat.path)}`}>Download</a>
        </div>
      ) : null}
    </aside>
  );
}
