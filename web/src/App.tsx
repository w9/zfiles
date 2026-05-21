import { useCallback, useEffect, useState } from "react";

type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
};

type KernelEvent =
  | { type: "connected"; version: string }
  | { type: "filesystem_changed"; path: string }
  | { type: "upload_progress"; id: string; offset: number; length?: number };

function encodeMetadata(filename: string): string {
  return `filename ${btoa(filename)}`;
}

async function uploadFile(file: File, targetPath: string): Promise<void> {
  const create = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Upload-Length": String(file.size),
      "Upload-Metadata": encodeMetadata(targetPath),
    },
  });

  if (!create.ok) {
    throw new Error(`upload create failed: HTTP ${create.status}`);
  }

  const location = create.headers.get("location");
  if (!location) {
    throw new Error("upload create missing location header");
  }

  const patch = await fetch(location, {
    method: "PATCH",
    headers: {
      "Upload-Offset": "0",
      "Content-Type": "application/offset+octet-stream",
    },
    body: file,
  });

  if (!patch.ok) {
    throw new Error(`upload patch failed: HTTP ${patch.status}`);
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadListing = useCallback(async (path: string) => {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    const response = await fetch(`/api/list${query}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: FileEntry[] = await response.json();
    setEntries(data);
    setCurrentPath(path);
    setError(null);
  }, []);

  useEffect(() => {
    loadListing("").catch((err: Error) => setError(err.message));
  }, [loadListing]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as KernelEvent;
      if (event.type === "filesystem_changed") {
        loadListing(currentPath).catch((err: Error) => setError(err.message));
      }
    };

    return () => socket.close();
  }, [currentPath, loadListing]);

  const breadcrumbs = currentPath
    ? ["", ...currentPath.split("/")]
    : [""];

  const navigateTo = (path: string) => {
    loadListing(path).catch((err: Error) => setError(err.message));
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const target = currentPath ? `${currentPath}/${file.name}` : file.name;
        await uploadFile(file, target);
      }
      await loadListing(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="shell">
      <header>
        <h1>zfiles</h1>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((part, index) => {
            const path = breadcrumbs.slice(1, index + 1).join("/");
            const label = index === 0 ? "root" : part;
            return (
              <button
                key={`${part}-${index}`}
                type="button"
                className="crumb"
                onClick={() => navigateTo(path)}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      <section
        className="dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onUpload(event.dataTransfer.files);
        }}
      >
        <p>{uploading ? "Uploading…" : "Drop files here to upload"}</p>
        <label className="upload-button">
          Choose files
          <input
            type="file"
            multiple
            hidden
            onChange={(event) => void onUpload(event.target.files)}
          />
        </label>
      </section>

      {error && <p className="error">{error}</p>}

      <ul className="listing">
        {currentPath && (
          <li>
            <button type="button" className="entry" onClick={() => {
              const parent = currentPath.split("/").slice(0, -1).join("/");
              navigateTo(parent);
            }}>
              <span className="name">📁 ..</span>
            </button>
          </li>
        )}
        {entries.map((entry) => (
          <li key={entry.path}>
            {entry.is_dir ? (
              <button
                type="button"
                className="entry"
                onClick={() => navigateTo(entry.path)}
              >
                <span className="name">📁 {entry.name}</span>
              </button>
            ) : (
              <a className="entry" href={`/api/file?path=${encodeURIComponent(entry.path)}`}>
                <span className="name">📄 {entry.name}</span>
                <span className="size">{entry.size} B</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
