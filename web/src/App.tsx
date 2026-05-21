import { useEffect, useState } from "react";

type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
};

export default function App() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/list")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data: FileEntry[]) => setEntries(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="shell">
      <header>
        <h1>zfiles</h1>
        <p>Kernel file listing</p>
      </header>

      {error && <p className="error">Failed to load listing: {error}</p>}

      <ul className="listing">
        {entries.map((entry) => (
          <li key={entry.path}>
            <span className="name">{entry.is_dir ? "📁" : "📄"} {entry.name}</span>
            {!entry.is_dir && <span className="size">{entry.size} B</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
