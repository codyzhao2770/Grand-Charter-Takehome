"use client";

import { useState, useCallback } from "react";
import SchemaSearch from "./SchemaSearch";
import Pagination from "./Pagination";
import usePaginatedFilter from "./usePaginatedFilter";

interface InferredInterface {
  name: string;
  tableName: string;
  associatedTables: string[];
  properties: { name: string; type: string; isOptional: boolean }[];
}

export default function InterfacesTab({ interfaces }: { interfaces: InferredInterface[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filterFn = useCallback(
    (iface: InferredInterface, q: string) =>
      iface.name.toLowerCase().includes(q) ||
      iface.tableName.toLowerCase().includes(q) ||
      iface.associatedTables?.some((t) => t.toLowerCase().includes(q)) ||
      iface.properties.some((p) => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)),
    []
  );

  const { search, setSearch, page, setPage, totalPages, paged, totalItems, pageSize } =
    usePaginatedFilter(interfaces, filterFn);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div>
      <SchemaSearch value={search} onChange={setSearch} placeholder="Search interfaces, tables, or properties..." />
      <div className="space-y-1">
        {paged.map((iface) => (
          <div key={iface.name} className="border border-zinc-200 dark:border-zinc-800 rounded">
            <button
              onClick={() => toggle(iface.name)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-mono font-medium shrink-0">{iface.name}</span>
                <span className="text-xs text-zinc-500 truncate">table: {iface.tableName}</span>
              </div>
              <span className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
                <span>{iface.properties.length} props</span>
                {iface.associatedTables?.length > 0 && (
                  <span>{iface.associatedTables.length} assoc</span>
                )}
                <span className="text-zinc-400">{expanded.has(iface.name) ? "▲" : "▼"}</span>
              </span>
            </button>
            {expanded.has(iface.name) && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
                {iface.associatedTables?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-xs text-zinc-400">Associated:</span>
                    {iface.associatedTables.map((t) => (
                      <span key={t} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded overflow-x-auto">
{`interface ${iface.name} {\n${iface.properties
  .map((p) => `  ${p.name}${p.isOptional ? "?" : ""}: ${p.type};`)
  .join("\n")}\n}`}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
      {paged.length === 0 && <p className="text-zinc-500 text-sm mt-2">No interfaces match your search.</p>}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
