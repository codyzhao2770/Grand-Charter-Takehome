"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
}

interface DbConnection {
  id: string;
  name: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [connections, setConnections] = useState<DbConnection[]>([]);

  useEffect(() => {
    fetch("/api/folders/tree")
      .then((r) => r.json())
      .then((d) => setFolders(d.data || []))
      .catch(() => {});
    fetch("/api/db-connections")
      .then((r) => r.json())
      .then((d) => setConnections(d.data || []))
      .catch(() => {});
  }, []);

  return (
    <aside className="w-64 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/files" className="text-lg font-bold">
          DataVault
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <Link
          href="/files"
          className={`block px-3 py-2 rounded text-sm ${
            pathname === "/files"
              ? "bg-zinc-200 dark:bg-zinc-800 font-medium"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          All Files
        </Link>

        {folders.map((f) => (
          <Link
            key={f.id}
            href={`/files/${f.id}`}
            className={`block px-3 py-1.5 rounded text-sm truncate ${
              pathname === `/files/${f.id}`
                ? "bg-zinc-200 dark:bg-zinc-800 font-medium"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
            style={{ paddingLeft: `${(f.depth + 1) * 16 + 12}px` }}
          >
            {f.name}
          </Link>
        ))}

        <div className="pt-4 pb-1 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          DB Connections
        </div>

        {connections.map((c) => (
          <Link
            key={c.id}
            href={`/db/${c.id}`}
            className={`block px-3 py-1.5 rounded text-sm truncate ${
              pathname.startsWith(`/db/${c.id}`)
                ? "bg-zinc-200 dark:bg-zinc-800 font-medium"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            {c.name}
          </Link>
        ))}

        <Link
          href="/db/new"
          className="block px-3 py-1.5 rounded text-sm text-blue-600 dark:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          + Add Connection
        </Link>
      </nav>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <Link
          href="/search"
          className="block px-3 py-2 rounded text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Search
        </Link>
      </div>
    </aside>
  );
}
