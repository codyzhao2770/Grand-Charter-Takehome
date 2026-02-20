"use client";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  totalItems: number;
  pageSize: number;
}) {
  if (totalPages <= 1) return null;
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
      <span className="text-xs text-zinc-500">
        {start}&ndash;{end} of {totalItems}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Prev
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Next
        </button>
      </div>
    </div>
  );
}
