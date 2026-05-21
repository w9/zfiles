import { useEffect, useState } from "react";

type FileStat = {
  path: string;
  is_dir: boolean;
  size: number;
  modified?: string;
};

type PreviewPaneProps = {
  path: string | null;
};

export default function PreviewPane({ path }: PreviewPaneProps) {
  const [stat, setStat] = useState<FileStat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setStat(null);
      setError(null);
      return;
    }

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
  }, [path]);

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
          <p className="meta">No viewer plugin registered for this file type.</p>
          <a href={`/api/file?path=${encodeURIComponent(stat.path)}`}>Download</a>
        </div>
      ) : null}
    </aside>
  );
}
