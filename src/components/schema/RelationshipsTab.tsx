"use client";

import { useCallback } from "react";
import SchemaSearch from "./SchemaSearch";
import Pagination from "@/components/ui/Pagination";
import usePaginatedFilter from "./usePaginatedFilter";

interface Relationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export default function RelationshipsTab({ relationships }: { relationships: Relationship[] }) {
  const filterFn = useCallback(
    (r: Relationship, q: string) =>
      r.sourceTable.toLowerCase().includes(q) ||
      r.sourceColumn.toLowerCase().includes(q) ||
      r.targetTable.toLowerCase().includes(q) ||
      r.targetColumn.toLowerCase().includes(q),
    []
  );

  const { search, setSearch, page, setPage, totalPages, paged, totalItems, pageSize } =
    usePaginatedFilter(relationships, filterFn);

  return (
    <div>
      <SchemaSearch value={search} onChange={setSearch} placeholder="Search by table or column..." />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dark:border-zinc-800">
            <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">From</th>
            <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">To</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((r, i) => (
            <tr key={i} className="border-b dark:border-zinc-800">
              <td className="py-1.5 px-2 font-mono text-xs">
                <span className="font-medium">{r.sourceTable}</span>.{r.sourceColumn}
              </td>
              <td className="py-1.5 px-2 font-mono text-xs">
                <span className="font-medium">{r.targetTable}</span>.{r.targetColumn}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {paged.length === 0 && <p className="text-zinc-500 text-sm mt-2">No relationships match your search.</p>}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} className="mt-3" />
    </div>
  );
}
