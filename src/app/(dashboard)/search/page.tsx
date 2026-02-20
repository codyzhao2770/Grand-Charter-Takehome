"use client";

import { useState } from "react";
import Link from "next/link";

interface SearchResults {
  files: { id: string; name: string; mimeType: string; size: number; folderId: string | null; type: "file" }[];
  folders: { id: string; name: string; parentId: string | null; type: "folder" }[];
  dbConnections: { id: string; name: string; type: "db_connection" }[];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.data || null);
    setLoading(false);
  }

  const total = results
    ? results.files.length + results.folders.length + results.dbConnections.length
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, folders, and connections..."
            className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {results && (
        <div>
          <p className="text-sm text-zinc-500 mb-4">{total} results found</p>

          {results.folders.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Folders</h2>
              {results.folders.map((f) => (
                <Link
                  key={f.id}
                  href={`/files/${f.id}`}
                  className="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded text-sm"
                >
                  {f.name}
                </Link>
              ))}
            </div>
          )}

          {results.files.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Files</h2>
              {results.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded">
                  <span className="text-sm">{f.name}</span>
                  <a href={`/api/files/${f.id}`} className="text-xs text-blue-600">Download</a>
                </div>
              ))}
            </div>
          )}

          {results.dbConnections.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">DB Connections</h2>
              {results.dbConnections.map((c) => (
                <Link
                  key={c.id}
                  href={`/db/${c.id}`}
                  className="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded text-sm"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {total === 0 && <p className="text-zinc-500 text-sm">No results found.</p>}
        </div>
      )}
    </div>
  );
}
