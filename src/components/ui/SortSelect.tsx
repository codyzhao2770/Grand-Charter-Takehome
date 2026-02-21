"use client";

export type SortOption = "name-asc" | "name-desc" | "recent" | "oldest";

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export default function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 cursor-pointer"
    >
      <option value="name-asc">Name (A-Z)</option>
      <option value="name-desc">Name (Z-A)</option>
      <option value="recent">Most Recent</option>
      <option value="oldest">Oldest First</option>
    </select>
  );
}
