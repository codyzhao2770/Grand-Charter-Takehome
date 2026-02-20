"use client";

import { useState, useCallback } from "react";
import SchemaSearch from "./SchemaSearch";
import Pagination from "./Pagination";
import usePaginatedFilter from "./usePaginatedFilter";

interface EnumType {
  name: string;
  values: string[];
}

export default function EnumsTab({ enums }: { enums: EnumType[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filterFn = useCallback(
    (e: EnumType, q: string) =>
      e.name.toLowerCase().includes(q) ||
      e.values.some((v) => v.toLowerCase().includes(q)),
    []
  );

  const { search, setSearch, page, setPage, totalPages, paged, totalItems, pageSize } =
    usePaginatedFilter(enums, filterFn);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (enums.length === 0) return <p className="text-zinc-500 text-sm">No enums found.</p>;

  return (
    <div>
      <SchemaSearch value={search} onChange={setSearch} placeholder="Search enums..." />
      <div className="space-y-1">
        {paged.map((e) => (
          <div key={e.name} className="border border-zinc-200 dark:border-zinc-800 rounded">
            <button
              onClick={() => toggle(e.name)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              <span className="font-mono font-medium">{e.name}</span>
              <span className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{e.values.length} values</span>
                <span className="text-zinc-400">{expanded.has(e.name) ? "▲" : "▼"}</span>
              </span>
            </button>
            {expanded.has(e.name) && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {e.values.map((v) => (
                    <span
                      key={v}
                      className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {paged.length === 0 && <p className="text-zinc-500 text-sm mt-2">No enums match your search.</p>}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
