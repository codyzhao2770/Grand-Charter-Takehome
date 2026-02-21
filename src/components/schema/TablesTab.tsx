"use client";

import { useState, useCallback } from "react";
import SchemaSearch from "./SchemaSearch";
import Pagination from "@/components/ui/Pagination";
import usePaginatedFilter from "./usePaginatedFilter";

interface SchemaTable {
  name: string;
  columns: {
    name: string;
    dataType: string;
    udtName: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
  }[];
  estimatedRowCount: number;
}

export default function TablesTab({ tables }: { tables: SchemaTable[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filterFn = useCallback(
    (t: SchemaTable, q: string) =>
      t.name.toLowerCase().includes(q) ||
      t.columns.some((c) => c.name.toLowerCase().includes(q)),
    []
  );

  const { search, setSearch, page, setPage, totalPages, paged, totalItems, pageSize } =
    usePaginatedFilter(tables, filterFn);

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
      <SchemaSearch value={search} onChange={setSearch} placeholder="Search tables or columns..." />
      <div className="space-y-1">
        {paged.map((t) => (
          <div key={t.name} className="border border-zinc-200 dark:border-zinc-800 rounded">
            <button
              onClick={() => toggle(t.name)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              <span className="font-medium font-mono">{t.name}</span>
              <span className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{t.columns.length} cols</span>
                <span>~{t.estimatedRowCount.toLocaleString()} rows</span>
                <span className="text-zinc-400">{expanded.has(t.name) ? "▲" : "▼"}</span>
              </span>
            </button>
            {expanded.has(t.name) && (
              <div className="border-t border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-zinc-500">Column</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-zinc-500">Type</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-zinc-500">Nullable</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-zinc-500">Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.columns.map((c) => (
                      <tr key={c.name} className="border-b dark:border-zinc-800 last:border-0">
                        <td className="py-1 px-3 font-mono text-xs">{c.name}</td>
                        <td className="py-1 px-3 text-xs">{c.udtName}</td>
                        <td className="py-1 px-3 text-xs">{c.isNullable ? "yes" : "no"}</td>
                        <td className="py-1 px-3 text-xs">
                          {c.isPrimaryKey && <span className="text-amber-600 font-medium">PK</span>}
                          {c.isForeignKey && <span className="text-blue-600 font-medium ml-1">FK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
      {paged.length === 0 && <p className="text-zinc-500 text-sm mt-2">No tables match your search.</p>}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} className="mt-3" />
    </div>
  );
}
