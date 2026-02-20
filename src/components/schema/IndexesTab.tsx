"use client";

import { useCallback } from "react";
import SchemaSearch from "./SchemaSearch";
import Pagination from "./Pagination";
import usePaginatedFilter from "./usePaginatedFilter";

interface Index {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export default function IndexesTab({ indexes }: { indexes: Index[] }) {
  const filterFn = useCallback(
    (idx: Index, q: string) =>
      idx.name.toLowerCase().includes(q) ||
      idx.tableName.toLowerCase().includes(q) ||
      idx.columns.some((c) => c.toLowerCase().includes(q)),
    []
  );

  const { search, setSearch, page, setPage, totalPages, paged, totalItems, pageSize } =
    usePaginatedFilter(indexes, filterFn);

  return (
    <div>
      <SchemaSearch value={search} onChange={setSearch} placeholder="Search by index name, table, or column..." />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dark:border-zinc-800">
            <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Name</th>
            <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Table</th>
            <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Columns</th>
            <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Type</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((idx) => (
            <tr key={idx.name} className="border-b dark:border-zinc-800">
              <td className="py-1.5 px-2 font-mono text-xs">{idx.name}</td>
              <td className="py-1.5 px-2 text-xs">{idx.tableName}</td>
              <td className="py-1.5 px-2 font-mono text-xs">{idx.columns.join(", ")}</td>
              <td className="py-1.5 px-2 text-xs">
                {idx.isPrimary ? (
                  <span className="text-amber-600 font-medium">PK</span>
                ) : idx.isUnique ? (
                  <span className="text-blue-600 font-medium">Unique</span>
                ) : (
                  "Index"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {paged.length === 0 && <p className="text-zinc-500 text-sm mt-2">No indexes match your search.</p>}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
